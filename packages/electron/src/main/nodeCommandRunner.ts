import { spawn } from "node:child_process"
import { Effect, Layer, Schema } from "effect"
import { CommandError, CommandRunner, isRateLimitError, JsonParseError, parseRetryAfterSeconds, RateLimitError } from "@ghui/core/node"

const collectStream = (stream: NodeJS.ReadableStream): Promise<string> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		stream.on("data", (chunk: Buffer) => chunks.push(chunk))
		stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
		stream.on("error", reject)
	})

export const NodeCommandRunner = {
	layer: Layer.effect(
		CommandRunner,
		Effect.gen(function* () {
			const runProcess = Effect.fn("CommandRunner.runProcess")((command: string, args: readonly string[], stdin: string | undefined) =>
				Effect.tryPromise({
					async try() {
						const proc = spawn(command, [...args], {
							stdio: [stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
						})
						if (stdin !== undefined && proc.stdin) {
							proc.stdin.write(stdin)
							proc.stdin.end()
						}
						const [stdout, stderr, exitCode] = await Promise.all([
							collectStream(proc.stdout!),
							collectStream(proc.stderr!),
							new Promise<number>((resolve, reject) => {
								proc.on("close", (code) => resolve(code ?? 1))
								proc.on("error", reject)
							}),
						])
						return { stdout, stderr, exitCode }
					},
					catch: (cause) => new CommandError({ command, args: [...args], detail: `Failed to run ${command}`, cause }),
				}),
			)

			const run = Effect.fn("CommandRunner.run")(function* (command: string, args: readonly string[], options?: { readonly stdin?: string }) {
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
	),
}
