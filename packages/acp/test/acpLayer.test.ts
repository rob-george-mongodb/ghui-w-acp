import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { ACPStore, makeACPLayer } from "@ghui/acp"

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const tempStorePath = async () => {
	const dir = await mkdtemp(join(tmpdir(), "ghui-acp-"))
	tempDirs.push(dir)
	return join(dir, "acp.sqlite")
}

describe("makeACPLayer", () => {
	test("ACPStore is populated after session upsert", async () => {
		const storePath = await tempStorePath()
		const layer = makeACPLayer({ storePath })

		await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertSession({
					sessionId: "test-session",
					prKey: "owner/repo#1",
					worktreePath: "/tmp/wt",
					sessionType: "review",
					agentName: "test-agent",
					startedAt: new Date("2026-01-01T00:00:00Z"),
					endedAt: null,
					stopReason: null,
				})
				const sessions = yield* store.listSessions("owner/repo#1")
				expect(sessions).toHaveLength(1)
				expect(sessions[0]?.sessionId).toBe("test-session")
			}).pipe(Effect.provide(layer)),
		)
	})

	test("makeACPLayer with storePath: null returns disabled (no-op) store", async () => {
		const layer = makeACPLayer({ storePath: null })

		const sessions = await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertSession({
					sessionId: "noop-session",
					prKey: "owner/repo#2",
					worktreePath: "/tmp/wt2",
					sessionType: "chat",
					agentName: "test-agent",
					startedAt: new Date("2026-01-01T00:00:00Z"),
					endedAt: null,
					stopReason: null,
				})
				return yield* store.listSessions("owner/repo#2")
			}).pipe(Effect.provide(layer)),
		)

		expect(sessions).toHaveLength(0)
	})
})
