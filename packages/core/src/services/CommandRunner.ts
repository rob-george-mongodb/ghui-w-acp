import { Context, Effect, Layer, Schema } from "effect"

export interface CommandResult {
	readonly stdout: string
	readonly stderr: string
	readonly exitCode: number
}

export interface RunOptions {
	readonly stdin?: string
}

export class CommandError extends Schema.TaggedErrorClass<CommandError>()("CommandError", {
	command: Schema.String,
	args: Schema.Array(Schema.String),
	detail: Schema.String,
	cause: Schema.Defect,
}) {}

export class RateLimitError extends Schema.TaggedErrorClass<RateLimitError>()("RateLimitError", {
	command: Schema.String,
	args: Schema.Array(Schema.String),
	detail: Schema.String,
	retryAfterSeconds: Schema.optionalKey(Schema.NullOr(Schema.Number)),
}) {}

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
	command: Schema.String,
	args: Schema.Array(Schema.String),
	stdout: Schema.String,
	cause: Schema.Defect,
}) {}

const RATE_LIMIT_PATTERNS = [/rate limit/i, /API rate limit exceeded/i, /abuse detection/i, /secondary rate limit/i, /retry after/i]

export const isRateLimitError = (stderr: string): boolean => RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(stderr))

export const parseRetryAfterSeconds = (stderr: string): number | null => {
	const match = stderr.match(/retry after (\d+)/i)
	return match ? Number(match[1]) : null
}

const readStream = async (stream: ReadableStream | null | undefined) => {
	if (!stream) return ""
	return Bun.readableStreamToText(stream)
}

export class CommandRunner extends Context.Service<
	CommandRunner,
	{
		readonly run: (command: string, args: readonly string[], options?: RunOptions) => Effect.Effect<CommandResult, CommandError | RateLimitError>
		readonly runSchema: <S extends Schema.Top>(
			schema: S,
			command: string,
			args: readonly string[],
		) => Effect.Effect<S["Type"], CommandError | RateLimitError | JsonParseError | Schema.SchemaError, S["DecodingServices"]>
	}
>()("ghui/CommandRunner") {
	static readonly layer = Layer.effect(
		CommandRunner,
		Effect.gen(function* () {
			const runProcess = Effect.fn("CommandRunner.runProcess")((command: string, args: readonly string[], stdin: string | undefined) =>
				Effect.tryPromise({
					async try() {
						const proc = Bun.spawn({
							cmd: [command, ...args],
							stdin: stdin === undefined ? "ignore" : "pipe",
							stdout: "pipe",
							stderr: "pipe",
						})
						if (stdin !== undefined && proc.stdin) {
							proc.stdin.write(stdin)
							proc.stdin.end()
						}

						const [exitCode, stdout, stderr] = await Promise.all([proc.exited, readStream(proc.stdout), readStream(proc.stderr)])
						return { stdout, stderr, exitCode }
					},
					catch: (cause) => new CommandError({ command, args: [...args], detail: `Failed to run ${command}`, cause }),
				}),
			)

			const run = Effect.fn("CommandRunner.run")(function* (command: string, args: readonly string[], options?: RunOptions) {
				const result = yield* runProcess(command, args, options?.stdin).pipe(
					Effect.withSpan("ghui.command.runProcess", {
						attributes: {
							"process.command": command,
							"process.argv.count": args.length,
						},
					}),
				)
				if (result.exitCode !== 0) {
					const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
					if (isRateLimitError(detail)) {
						return yield* new RateLimitError({ command, args: [...args], detail, retryAfterSeconds: parseRetryAfterSeconds(detail) })
					}
					return yield* new CommandError({ command, args: [...args], detail, cause: detail })
				}
				return result
			})

			const runJson = Effect.fn("CommandRunner.runJson")(function* <A>(command: string, args: readonly string[]) {
				const result = yield* run(command, args)
				return yield* Effect.try({
					try: () => JSON.parse(result.stdout) as A,
					catch: (cause) => new JsonParseError({ command, args: [...args], stdout: result.stdout, cause }),
				})
			})

			const runSchema = Effect.fn("CommandRunner.runSchema")(function* <S extends Schema.Top>(schema: S, command: string, args: readonly string[]) {
				const value = yield* runJson<unknown>(command, args)
				return yield* Schema.decodeUnknownEffect(schema)(value)
			})

			return CommandRunner.of({ run, runSchema })
		}),
	)
}
