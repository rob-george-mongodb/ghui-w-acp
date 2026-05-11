import { Context, Effect, Schema } from "effect"

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
>()("ghui/CommandRunner") {}
