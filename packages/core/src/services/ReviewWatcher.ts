import { existsSync, readFileSync } from "node:fs"
import { Context, Effect, Layer } from "effect"
import type { ReviewFinding } from "../domain.js"
import { CacheService } from "./CacheService.js"

interface WatchParams {
	readonly reviewDir: string
	readonly prKey: string
	readonly sessionId: string
	readonly headRefOid: string
	readonly onFinding?: (finding: ReviewFinding) => Effect.Effect<void>
	readonly initialOffset?: number
}

export class ReviewWatcher extends Context.Service<
	ReviewWatcher,
	{
		readonly watch: (params: WatchParams) => Effect.Effect<never>
		readonly finalSweep: (params: WatchParams & { readonly lastOffset: number }) => Effect.Effect<number>
	}
>()("ghui/ReviewWatcher") {
	static readonly layer: Layer.Layer<ReviewWatcher, never, CacheService> = Layer.effect(
		ReviewWatcher,
		Effect.gen(function* () {
			const cache = yield* CacheService

			const processLines = (lines: readonly string[], params: WatchParams): Effect.Effect<void> =>
				Effect.gen(function* () {
					for (const line of lines) {
						try {
							const raw = JSON.parse(line) as Record<string, unknown>
							const finding: ReviewFinding = {
								id: String(raw.id ?? ""),
								prKey: params.prKey,
								sessionId: params.sessionId,
								headRefOid: params.headRefOid,
								source: "ai",
								filePath: (raw.filePath as string | null) ?? null,
								lineStart: (raw.lineStart as number | null) ?? null,
								lineEnd: (raw.lineEnd as number | null) ?? null,
								diffSide: (raw.diffSide as ReviewFinding["diffSide"]) ?? null,
								title: (raw.title as string | null) ?? null,
								body: String(raw.body ?? ""),
								severity: (raw.severity as ReviewFinding["severity"]) ?? null,
								status: "pending_review",
								modifiedBody: null,
								postedUrl: null,
								createdAt: new Date(String(raw.createdAt ?? new Date().toISOString())),
								updatedAt: new Date(String(raw.createdAt ?? new Date().toISOString())),
							}
							yield* cache.upsertFinding(finding)
							if (params.onFinding) {
								yield* params.onFinding(finding)
							}
						} catch (e) {
							console.error("[ReviewWatcher] Failed to parse finding line:", e)
						}
					}
				})

			const readNewLines = (
				path: string,
				lastOffset: number,
			): { lines: readonly string[]; newOffset: number } => {
				if (!existsSync(path)) return { lines: [], newOffset: lastOffset }
				const content = readFileSync(path)
				const chunk = content.subarray(lastOffset)
				if (chunk.length === 0) return { lines: [], newOffset: lastOffset }
				const text = chunk.toString("utf8")
				const lastNewline = text.lastIndexOf("\n")
				if (lastNewline === -1) return { lines: [], newOffset: lastOffset }
				const processable = text.slice(0, lastNewline + 1)
				const newOffset = lastOffset + Buffer.byteLength(processable, "utf8")
				const lines = processable.split("\n").filter((l) => l.trim().length > 0)
				return { lines, newOffset }
			}

			const watch = (params: WatchParams): Effect.Effect<never> => {
				const findingsPath = `${params.reviewDir}/findings.jsonl`
				let lastOffset = params.initialOffset ?? 0
				return Effect.forever(
					Effect.gen(function* () {
						const { lines, newOffset } = readNewLines(findingsPath, lastOffset)
						lastOffset = newOffset
						if (lines.length > 0) {
							yield* processLines(lines, params)
						}
						yield* Effect.sleep("500 millis")
					}),
				)
			}

			const finalSweep = (
				params: WatchParams & { readonly lastOffset: number },
			): Effect.Effect<number> =>
				Effect.gen(function* () {
					const findingsPath = `${params.reviewDir}/findings.jsonl`
					const { lines, newOffset } = readNewLines(findingsPath, params.lastOffset)
					if (lines.length > 0) {
						yield* processLines(lines, params)
					}
					return newOffset
				})

			return ReviewWatcher.of({ watch, finalSweep })
		}),
	)
}
