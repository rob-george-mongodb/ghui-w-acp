import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { ACPStore, ReviewWatcher } from "@ghui/acp"

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const tempStorePath = async () => {
	const dir = await mkdtemp(join(tmpdir(), "ghui-rw-"))
	tempDirs.push(dir)
	return join(dir, "acp.sqlite")
}

const tempReviewDir = async () => {
	const dir = await mkdtemp(join(tmpdir(), "ghui-review-"))
	tempDirs.push(dir)
	return dir
}

const runWatcher = async <A, E>(filename: string, effect: Effect.Effect<A, E, ReviewWatcher | ACPStore>) =>
	Effect.runPromise(
		effect.pipe(
			Effect.provide(ReviewWatcher.layer),
			Effect.provide(ACPStore.layerSqliteFile(filename)),
		),
	)

const baseParams = (reviewDir: string) => ({
	reviewDir,
	prKey: "owner/repo#1",
	sessionId: "sess-1",
	headRefOid: "abc123",
})

const makeFindingLine = (id: string, body = "test") =>
	JSON.stringify({
		id,
		filePath: null,
		lineStart: null,
		lineEnd: null,
		diffSide: null,
		title: null,
		body,
		severity: null,
		createdAt: new Date().toISOString(),
	})

describe("ReviewWatcher", () => {
	test("partial-line safety: incomplete line is not processed until newline appended", async () => {
		const storePath = await tempStorePath()
		const reviewDir = await tempReviewDir()
		const findingsPath = join(reviewDir, "findings.jsonl")

		await writeFile(findingsPath, makeFindingLine("f-partial"))

		await runWatcher(
			storePath,
			Effect.gen(function* () {
				const watcher = yield* ReviewWatcher
				const store = yield* ACPStore
				const offset = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: 0 })
				expect(offset).toBe(0)
				const findings = yield* store.listFindings("owner/repo#1")
				expect(findings).toHaveLength(0)

				yield* Effect.promise(() => appendFile(findingsPath, "\n"))
				const offset2 = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: 0 })
				expect(offset2).toBeGreaterThan(0)
				const findings2 = yield* store.listFindings("owner/repo#1")
				expect(findings2).toHaveLength(1)
				expect(findings2[0]?.id).toBe("f-partial")
			}),
		)
	})

	test("complete line processing: two lines processed, idempotent re-sweep", async () => {
		const storePath = await tempStorePath()
		const reviewDir = await tempReviewDir()
		const findingsPath = join(reviewDir, "findings.jsonl")

		await writeFile(findingsPath, makeFindingLine("f-1") + "\n" + makeFindingLine("f-2") + "\n")

		await runWatcher(
			storePath,
			Effect.gen(function* () {
				const watcher = yield* ReviewWatcher
				const store = yield* ACPStore
				const offset = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: 0 })
				expect(offset).toBeGreaterThan(0)
				const findings = yield* store.listFindings("owner/repo#1")
				expect(findings).toHaveLength(2)

				const offset2 = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: offset })
				expect(offset2).toBe(offset)
			}),
		)
	})

	test("missing file: returns 0 and no error", async () => {
		const storePath = await tempStorePath()
		const reviewDir = await tempReviewDir()

		await runWatcher(
			storePath,
			Effect.gen(function* () {
				const watcher = yield* ReviewWatcher
				const offset = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: 0 })
				expect(offset).toBe(0)
			}),
		)
	})

	test("malformed JSON: skipped without error, valid lines still processed", async () => {
		const storePath = await tempStorePath()
		const reviewDir = await tempReviewDir()
		const findingsPath = join(reviewDir, "findings.jsonl")

		await writeFile(findingsPath, "not valid json\n" + makeFindingLine("f-valid") + "\n")

		await runWatcher(
			storePath,
			Effect.gen(function* () {
				const watcher = yield* ReviewWatcher
				const store = yield* ACPStore
				const offset = yield* watcher.finalSweep({ ...baseParams(reviewDir), lastOffset: 0 })
				expect(offset).toBeGreaterThan(0)
				const findings = yield* store.listFindings("owner/repo#1")
				expect(findings).toHaveLength(1)
				expect(findings[0]?.id).toBe("f-valid")
			}),
		)
	})
})
