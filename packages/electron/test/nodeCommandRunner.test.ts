import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema } from "effect"
import { CommandError, CommandRunner, JsonParseError } from "@ghui/core/node"
import { NodeCommandRunner } from "../src/main/nodeCommandRunner.js"

const runWith = <A, E>(effect: Effect.Effect<A, E, CommandRunner>) =>
	Effect.runPromiseExit(Effect.provide(effect, NodeCommandRunner.layer))

describe("NodeCommandRunner", () => {
	test("successful command returns stdout and exitCode 0", async () => {
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.run("echo", ["hello"])
			}),
		)
		expect(Exit.isSuccess(exit)).toBe(true)
		if (Exit.isSuccess(exit)) {
			expect(exit.value.stdout.trim()).toBe("hello")
			expect(exit.value.exitCode).toBe(0)
		}
	})

	test("failed command returns CommandError", async () => {
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.run("ls", ["/nonexistent-path-xyz-abc-123"])
			}),
		)
		expect(Exit.isFailure(exit)).toBe(true)
		if (Exit.isFailure(exit)) {
			const cause = exit.cause
			const error = cause.toString()
			expect(error).toContain("CommandError")
		}
	})

	test("stdin is piped to the process", async () => {
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.run("cat", [], { stdin: "test input" })
			}),
		)
		expect(Exit.isSuccess(exit)).toBe(true)
		if (Exit.isSuccess(exit)) {
			expect(exit.value.stdout).toBe("test input")
		}
	})

	test("runSchema decodes valid JSON output", async () => {
		const TestSchema = Schema.Struct({ name: Schema.String })
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.runSchema(TestSchema, "echo", ['{"name":"test"}'])
			}),
		)
		expect(Exit.isSuccess(exit)).toBe(true)
		if (Exit.isSuccess(exit)) {
			expect(exit.value).toEqual({ name: "test" })
		}
	})

	test("runSchema with invalid JSON yields JsonParseError", async () => {
		const TestSchema = Schema.Struct({ name: Schema.String })
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.runSchema(TestSchema, "echo", ["not json"])
			}),
		)
		expect(Exit.isFailure(exit)).toBe(true)
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString()
			expect(error).toContain("JsonParseError")
		}
	})

	test("runSchema with schema mismatch yields SchemaError", async () => {
		const TestSchema = Schema.Struct({ name: Schema.String })
		const exit = await runWith(
			Effect.gen(function* () {
				const runner = yield* CommandRunner
				return yield* runner.runSchema(TestSchema, "echo", ['{"wrong":"shape"}'])
			}),
		)
		expect(Exit.isFailure(exit)).toBe(true)
		if (Exit.isFailure(exit)) {
			const error = exit.cause.toString()
			expect(error).toContain("name")
		}
	})
})
