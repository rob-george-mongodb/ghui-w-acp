import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import type { PullRequestItem } from "@ghui/core"
import type { PullRequestLoad } from "@ghui/core"
import type { PullRequestView } from "@ghui/core"
import type { ReviewWorktree, ReviewSession, SessionMessage, ReviewReport, ReviewFinding } from "@ghui/core"
import { BunCacheService, CacheService, pullRequestCacheKey } from "@ghui/core"

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const tempCachePath = async () => {
	const dir = await mkdtemp(join(tmpdir(), "ghui-cache-"))
	tempDirs.push(dir)
	return join(dir, "cache.sqlite")
}

const view: PullRequestView = { _tag: "Queue", mode: "authored", repository: null }

const pullRequest = (number: number, overrides: Partial<PullRequestItem> = {}): PullRequestItem => ({
	repository: "owner/repo",
	author: "author",
	headRefOid: `sha-${number}`,
	headRefName: `branch-${number}`,
	number,
	title: `PR ${number}`,
	body: "Body",
	labels: [{ name: "bug", color: "#d73a4a" }],
	additions: 10,
	deletions: 2,
	changedFiles: 3,
	state: "open",
	reviewStatus: "none",
	checkStatus: "passing",
	checkSummary: "1/1",
	checks: [{ name: "ci", status: "completed", conclusion: "success" }],
	autoMergeEnabled: false,
	detailLoaded: true,
	createdAt: new Date(`2026-01-${String(number).padStart(2, "0")}T00:00:00Z`),
	updatedAt: new Date(`2026-01-${String(number).padStart(2, "0")}T12:00:00Z`),
	closedAt: null,
	url: `https://github.com/owner/repo/pull/${number}`,
	totalCommentsCount: 0,
	mergeable: null,
	assignees: [],
	reviewRequests: [],
	...overrides,
})

const load = (data: readonly PullRequestItem[]): PullRequestLoad => ({
	view,
	data,
	fetchedAt: new Date(),
	endCursor: "cursor-1",
	hasNextPage: true,
})

const runCache = async <A, E>(filename: string, effect: Effect.Effect<A, E, CacheService>) => Effect.runPromise(effect.pipe(Effect.provide(BunCacheService.layerSqliteFile(filename))))

describe("CacheService", () => {
	test("persists queue order and revives dates", async () => {
		const filename = await tempCachePath()
		const first = pullRequest(1)
		const second = pullRequest(2, { title: "Second" })

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.writeQueue("alice", load([second, first]))
			}),
		)

		const cached = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readQueue("alice", view)
			}),
		)

		expect(cached?.data.map((item) => item.number)).toEqual([2, 1])
		expect(cached?.fetchedAt).toBeInstanceOf(Date)
		expect(cached?.data[0]?.createdAt).toBeInstanceOf(Date)
		expect(cached?.data[0]?.labels).toEqual([{ name: "bug", color: "#d73a4a" }])
		expect(cached?.endCursor).toBe("cursor-1")
		expect(cached?.hasNextPage).toBe(true)
	})

	test("scopes user queues by viewer", async () => {
		const filename = await tempCachePath()
		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.writeQueue("alice", load([pullRequest(1)]))
				yield* cache.writeQueue("bob", load([pullRequest(2)]))
			}),
		)

		const [alice, bob] = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* Effect.all([cache.readQueue("alice", view), cache.readQueue("bob", view)])
			}),
		)

		expect(alice?.data.map((item) => item.number)).toEqual([1])
		expect(bob?.data.map((item) => item.number)).toEqual([2])
	})

	test("reads hydrated pull request details by repository and number", async () => {
		const filename = await tempCachePath()
		const detail = pullRequest(3, { body: "Hydrated body", additions: 42 })

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertPullRequest(detail)
			}),
		)

		const cached = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readPullRequest({ repository: "owner/repo", number: 3 })
			}),
		)

		expect(cached?.body).toBe("Hydrated body")
		expect(cached?.additions).toBe(42)
		expect(cached?.createdAt).toBeInstanceOf(Date)
	})

	test("queue summaries do not clobber hydrated details", async () => {
		const filename = await tempCachePath()
		const detail = pullRequest(4, { body: "Hydrated body", additions: 42, detailLoaded: true })
		const summary = pullRequest(4, {
			body: "",
			labels: [],
			additions: 0,
			deletions: 0,
			changedFiles: 0,
			checkStatus: "failing",
			checkSummary: "0/1",
			detailLoaded: false,
		})

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertPullRequest(detail)
				yield* cache.writeQueue("alice", load([summary]))
				return yield* cache.readPullRequest({ repository: "owner/repo", number: 4 })
			}),
		).then((cached) => {
			expect(cached).toMatchObject({
				body: "Hydrated body",
				additions: 42,
				checkStatus: "failing",
				checkSummary: "0/1",
				detailLoaded: true,
			})
		})
	})

	test("skips corrupt pull request rows when reading queues", async () => {
		const filename = await tempCachePath()
		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.writeQueue("alice", load([pullRequest(1), pullRequest(2)]))
			}),
		)

		const db = new Database(filename)
		db.run("update pull_requests set data_json = ? where pr_key = ?", ["{", pullRequestCacheKey({ repository: "owner/repo", number: 1 })])
		db.close()

		const cached = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readQueue("alice", view)
			}),
		)

		expect(cached?.data.map((item) => item.number)).toEqual([2])
	})

	test("disabled layer is a no-op", async () => {
		const cached = await Effect.runPromise(
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.writeQueue("alice", load([pullRequest(1)]))
				return yield* cache.readQueue("alice", view)
			}).pipe(Effect.provide(CacheService.disabledLayer)),
		)

		expect(cached).toBeNull()
	})

	test("layerFromPath falls back to disabled cache when startup fails", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ghui-cache-fallback-"))
		tempDirs.push(dir)
		const blockedParent = join(dir, "not-a-directory")
		await Bun.write(blockedParent, "blocked")

		const cached = await Effect.runPromise(
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readQueue("alice", view)
			}		).pipe(Effect.provide(BunCacheService.layerFromPath(join(blockedParent, "cache.sqlite")))),
		)

		expect(cached).toBeNull()
	})

	test("round-trips new inbox fields through cache", async () => {
		const filename = await tempCachePath()
		const pr = pullRequest(5, {
			updatedAt: new Date("2026-01-15T00:00:00Z"),
			totalCommentsCount: 5,
			mergeable: "mergeable",
			assignees: [{ login: "assignee1" }],
			reviewRequests: [{ type: "user", name: "reviewer1" }],
		})

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertPullRequest(pr)
			}),
		)

		const cached = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readPullRequest({ repository: "owner/repo", number: 5 })
			}),
		)

		expect(cached?.updatedAt).toEqual(new Date("2026-01-15T00:00:00Z"))
		expect(cached?.totalCommentsCount).toBe(5)
		expect(cached?.mergeable).toBe("mergeable")
		expect(cached?.assignees).toEqual([{ login: "assignee1" }])
		expect(cached?.reviewRequests).toEqual([{ type: "user", name: "reviewer1" }])
	})

	test("old cached rows without new inbox fields decode with safe defaults", async () => {
		const filename = await tempCachePath()

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertPullRequest(pullRequest(6))
			}),
		)

		const db = new Database(filename)
		const row = db.query("SELECT data_json FROM pull_requests WHERE pr_key = 'owner/repo#6'").get() as { data_json: string }
		const data = JSON.parse(row.data_json) as Record<string, unknown>
		delete data["updatedAt"]
		delete data["totalCommentsCount"]
		delete data["mergeable"]
		delete data["assignees"]
		delete data["reviewRequests"]
		db.run("UPDATE pull_requests SET data_json = ? WHERE pr_key = 'owner/repo#6'", [JSON.stringify(data)])
		db.close()

		const cached = await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				return yield* cache.readPullRequest({ repository: "owner/repo", number: 6 })
			}),
		)

		expect(cached).not.toBeNull()
		expect(cached?.updatedAt).toBeInstanceOf(Date)
		expect(cached?.totalCommentsCount).toBe(0)
		expect(cached?.mergeable).toBeNull()
		expect(cached?.assignees).toEqual([])
		expect(cached?.reviewRequests).toEqual([])
	})
})

describe("CacheService ACP methods", () => {
	test("worktree round-trip: upsert, list, delete", async () => {
		const filename = await tempCachePath()
		const wt: ReviewWorktree = {
			prKey: "owner/repo#10",
			worktreePath: "/tmp/wt-10",
			branchName: "review-10",
			createdAt: new Date("2026-01-10T00:00:00Z"),
		}

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertWorktree(wt)
				const list = yield* cache.listWorktrees()
				expect(list).toHaveLength(1)
				expect(list[0]?.prKey).toBe("owner/repo#10")
				expect(list[0]?.worktreePath).toBe("/tmp/wt-10")
				expect(list[0]?.branchName).toBe("review-10")
				expect(list[0]?.createdAt).toEqual(new Date("2026-01-10T00:00:00Z"))

				yield* cache.deleteWorktree("owner/repo#10")
				const afterDelete = yield* cache.listWorktrees()
				expect(afterDelete).toHaveLength(0)
			}),
		)
	})

	test("session round-trip: upsert, list, endSession", async () => {
		const filename = await tempCachePath()
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

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertSession(session)
				const list = yield* cache.listSessions("owner/repo#20")
				expect(list).toHaveLength(1)
				expect(list[0]?.sessionId).toBe("sess-1")
				expect(list[0]?.endedAt).toBeNull()

				yield* cache.endSession("sess-1", new Date("2026-01-20T01:00:00Z"), "completed")
				const after = yield* cache.listSessions("owner/repo#20")
				expect(after[0]?.endedAt).toEqual(new Date("2026-01-20T01:00:00Z"))
				expect(after[0]?.stopReason).toBe("completed")
			}),
		)
	})

	test("messages round-trip: append and list in order", async () => {
		const filename = await tempCachePath()
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

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.appendMessage(msg1)
				yield* cache.appendMessage(msg2)
				const list = yield* cache.listMessages("sess-m")
				expect(list).toHaveLength(2)
				expect(list[0]?.role).toBe("user")
				expect(list[1]?.role).toBe("assistant")
				expect(list[0]?.content).toBe("hello")
			}),
		)
	})

	test("report round-trip: upsert, get, overwrite", async () => {
		const filename = await tempCachePath()
		const report: ReviewReport = {
			sessionId: "sess-r",
			prKey: "owner/repo#30",
			verdict: "good_for_merge",
			reportMd: "# LGTM",
			canonicalPath: "/reports/r.md",
			submittedAt: new Date("2026-01-30T00:00:00Z"),
		}

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertReport(report)
				const got = yield* cache.getReport("sess-r")
				expect(got?.verdict).toBe("good_for_merge")
				expect(got?.reportMd).toBe("# LGTM")

				yield* cache.upsertReport({ ...report, verdict: "block_merge", reportMd: "# Nope" })
				const updated = yield* cache.getReport("sess-r")
				expect(updated?.verdict).toBe("block_merge")
				expect(updated?.reportMd).toBe("# Nope")
			}),
		)
	})

	test("finding round-trip: upsert, list, updateStatus, markPosted", async () => {
		const filename = await tempCachePath()
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

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertFinding(finding)
				const list = yield* cache.listFindings("owner/repo#40")
				expect(list).toHaveLength(1)
				expect(list[0]?.title).toBe("Potential bug")
				expect(list[0]?.status).toBe("pending_review")

				yield* cache.updateFindingStatus("find-1", "accepted", "Revised body")
				const afterStatus = yield* cache.listFindings("owner/repo#40")
				expect(afterStatus[0]?.status).toBe("accepted")
				expect(afterStatus[0]?.modifiedBody).toBe("Revised body")

				yield* cache.markFindingPosted("find-1", "https://github.com/owner/repo/pull/40#comment-1")
				const afterPosted = yield* cache.listFindings("owner/repo#40")
				expect(afterPosted[0]?.postedUrl).toBe("https://github.com/owner/repo/pull/40#comment-1")
			}),
		)
	})

	test("active-session uniqueness: second active session with same type+worktree is swallowed", async () => {
		const filename = await tempCachePath()
		const base = {
			prKey: "owner/repo#50",
			worktreePath: "/tmp/wt-50",
			sessionType: "review" as const,
			agentName: "test-agent",
			endedAt: null,
			stopReason: null,
		}

		await runCache(
			filename,
			Effect.gen(function* () {
				const cache = yield* CacheService
				yield* cache.upsertSession({ ...base, sessionId: "sess-a", startedAt: new Date("2026-01-01T00:00:00Z") })
				yield* cache.upsertSession({ ...base, sessionId: "sess-b", startedAt: new Date("2026-01-01T01:00:00Z") })

				const list = yield* cache.listSessions("owner/repo#50")
				expect(list).toHaveLength(1)

				yield* cache.endSession("sess-a", new Date("2026-01-01T02:00:00Z"), "done")
				yield* cache.upsertSession({ ...base, sessionId: "sess-c", startedAt: new Date("2026-01-01T03:00:00Z") })
				const afterEnd = yield* cache.listSessions("owner/repo#50")
				expect(afterEnd).toHaveLength(2)
			}),
		)
	})
})
