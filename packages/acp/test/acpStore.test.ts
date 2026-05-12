import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { ACPStore, type ReviewSession, type SessionMessage, type ReviewReport, type ReviewFinding } from "@ghui/acp"

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const tempStorePath = async () => {
	const dir = await mkdtemp(join(tmpdir(), "ghui-acp-store-"))
	tempDirs.push(dir)
	return join(dir, "acp.sqlite")
}

const runStore = async <A, E>(filename: string, effect: Effect.Effect<A, E, ACPStore>) =>
	Effect.runPromise(effect.pipe(Effect.provide(ACPStore.layerSqliteFile(filename))))

describe("ACPStore", () => {
	test("session round-trip: upsert, list, endSession", async () => {
		const filename = await tempStorePath()
		const session: ReviewSession = {
			sessionId: "sess-1",
			prKey: "owner/repo#20",
			worktreePath: "/tmp/wt-20",
			sessionType: "review",
			agentName: "test-agent",
			startedAt: new Date("2026-01-20T00:00:00Z"),
			endedAt: null,
			stopReason: null,
		}

		await runStore(
			filename,
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertSession(session)
				const list = yield* store.listSessions("owner/repo#20")
				expect(list).toHaveLength(1)
				expect(list[0]?.sessionId).toBe("sess-1")
				expect(list[0]?.endedAt).toBeNull()

				yield* store.endSession("sess-1", new Date("2026-01-20T01:00:00Z"), "completed")
				const after = yield* store.listSessions("owner/repo#20")
				expect(after[0]?.endedAt).toEqual(new Date("2026-01-20T01:00:00Z"))
				expect(after[0]?.stopReason).toBe("completed")
			}),
		)
	})

	test("messages round-trip: append and list in order", async () => {
		const filename = await tempStorePath()
		const msg1: SessionMessage = {
			id: "msg-1",
			sessionId: "sess-m",
			role: "user",
			content: "hello",
			createdAt: new Date("2026-01-01T00:00:00Z"),
		}
		const msg2: SessionMessage = {
			id: "msg-2",
			sessionId: "sess-m",
			role: "assistant",
			content: "hi there",
			createdAt: new Date("2026-01-01T00:01:00Z"),
		}

		await runStore(
			filename,
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.appendMessage(msg1)
				yield* store.appendMessage(msg2)
				const list = yield* store.listMessages("sess-m")
				expect(list).toHaveLength(2)
				expect(list[0]?.role).toBe("user")
				expect(list[1]?.role).toBe("assistant")
				expect(list[0]?.content).toBe("hello")
			}),
		)
	})

	test("report round-trip: upsert, get, overwrite", async () => {
		const filename = await tempStorePath()
		const report: ReviewReport = {
			sessionId: "sess-r",
			prKey: "owner/repo#30",
			verdict: "good_for_merge",
			reportMd: "# LGTM",
			canonicalPath: "/reports/r.md",
			submittedAt: new Date("2026-01-30T00:00:00Z"),
		}

		await runStore(
			filename,
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertReport(report)
				const got = yield* store.getReport("sess-r")
				expect(got?.verdict).toBe("good_for_merge")
				expect(got?.reportMd).toBe("# LGTM")

				yield* store.upsertReport({ ...report, verdict: "block_merge", reportMd: "# Nope" })
				const updated = yield* store.getReport("sess-r")
				expect(updated?.verdict).toBe("block_merge")
				expect(updated?.reportMd).toBe("# Nope")
			}),
		)
	})

	test("finding round-trip: upsert, list, updateStatus, markPosted", async () => {
		const filename = await tempStorePath()
		const now = new Date("2026-02-01T00:00:00Z")
		const finding: ReviewFinding = {
			id: "find-1",
			prKey: "owner/repo#40",
			sessionId: "sess-f",
			headRefOid: "abc123",
			source: "ai",
			filePath: "src/main.ts",
			lineStart: 10,
			lineEnd: 15,
			diffSide: "RIGHT",
			title: "Potential bug",
			body: "This looks wrong",
			severity: "warning",
			status: "pending_review",
			modifiedBody: null,
			postedUrl: null,
			createdAt: now,
			updatedAt: now,
		}

		await runStore(
			filename,
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertFinding(finding)
				const list = yield* store.listFindings("owner/repo#40")
				expect(list).toHaveLength(1)
				expect(list[0]?.title).toBe("Potential bug")
				expect(list[0]?.status).toBe("pending_review")

				yield* store.updateFindingStatus("find-1", "accepted", "Revised body")
				const afterStatus = yield* store.listFindings("owner/repo#40")
				expect(afterStatus[0]?.status).toBe("accepted")
				expect(afterStatus[0]?.modifiedBody).toBe("Revised body")

				yield* store.markFindingPosted("find-1", "https://github.com/owner/repo/pull/40#comment-1")
				const afterPosted = yield* store.listFindings("owner/repo#40")
				expect(afterPosted[0]?.postedUrl).toBe("https://github.com/owner/repo/pull/40#comment-1")
			}),
		)
	})

	test("active-session uniqueness: second active session with same type+worktree is swallowed", async () => {
		const filename = await tempStorePath()
		const base = {
			prKey: "owner/repo#50",
			worktreePath: "/tmp/wt-50",
			sessionType: "review" as const,
			agentName: "test-agent",
			endedAt: null,
			stopReason: null,
		}

		await runStore(
			filename,
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertSession({ ...base, sessionId: "sess-a", startedAt: new Date("2026-01-01T00:00:00Z") })
				yield* store.upsertSession({ ...base, sessionId: "sess-b", startedAt: new Date("2026-01-01T01:00:00Z") })

				const list = yield* store.listSessions("owner/repo#50")
				expect(list).toHaveLength(1)

				yield* store.endSession("sess-a", new Date("2026-01-01T02:00:00Z"), "done")
				yield* store.upsertSession({ ...base, sessionId: "sess-c", startedAt: new Date("2026-01-01T03:00:00Z") })
				const afterEnd = yield* store.listSessions("owner/repo#50")
				expect(afterEnd).toHaveLength(2)
			}),
		)
	})

	test("disabledLayer returns no-op store", async () => {
		const sessions = await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* ACPStore
				yield* store.upsertSession({
					sessionId: "noop",
					prKey: "owner/repo#99",
					worktreePath: "/tmp/wt-99",
					sessionType: "review",
					agentName: "test-agent",
					startedAt: new Date("2026-01-01T00:00:00Z"),
					endedAt: null,
					stopReason: null,
				})
				return yield* store.listSessions("owner/repo#99")
			}).pipe(Effect.provide(ACPStore.disabledLayer)),
		)

		expect(sessions).toHaveLength(0)
	})
})
