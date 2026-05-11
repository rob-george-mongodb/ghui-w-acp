import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { Context, Effect, Layer, Schema } from "effect"
import { AppConfigService } from "../config.js"
import type { PullRequestItem, ReviewWorktree } from "../domain.js"
import { CacheService } from "./CacheService.js"
import { CommandRunner } from "./CommandRunner.js"

export class WorktreeError extends Schema.TaggedErrorClass<WorktreeError>()("WorktreeError", {
	prKey: Schema.String,
	cause: Schema.Defect,
	message: Schema.String,
}) {}

const defaultWorktreeRoot = () =>
	join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "ghui", "worktrees")

export class WorktreeService extends Context.Service<
	WorktreeService,
	{
		readonly create: (pr: PullRequestItem) => Effect.Effect<ReviewWorktree, WorktreeError>
		readonly remove: (prKey: string) => Effect.Effect<void, WorktreeError>
		readonly list: () => Effect.Effect<readonly ReviewWorktree[], WorktreeError>
		readonly getWorktreePath: (prKey: string) => Effect.Effect<string | null, WorktreeError>
	}
>()("ghui/WorktreeService") {
	static readonly layer = Layer.effect(
		WorktreeService,
		Effect.gen(function* () {
			const config = yield* AppConfigService
			const cache = yield* CacheService
			const runner = yield* CommandRunner

			const worktreeRoot = config.jsonConfig.worktreeRoot ?? defaultWorktreeRoot()

			const create = (pr: PullRequestItem): Effect.Effect<ReviewWorktree, WorktreeError> =>
				Effect.gen(function* () {
					const repoPath = config.jsonConfig.repoMappings?.[pr.repository]
					const prKey = `${pr.repository}#${pr.number}`

					if (!repoPath) {
						return yield* Effect.fail(
							new WorktreeError({
								prKey,
								cause: new Error(`No repoMappings entry for ${pr.repository}`),
								message: `No local clone configured for ${pr.repository}. Add it to ~/.config/ghui/ghui.json under repoMappings.`,
							}),
						)
					}

					const [owner, repo] = pr.repository.split("/") as [string, string]
					const worktreePath = join(worktreeRoot, owner, repo, String(pr.number))

					yield* runner.run("git", ["-C", repoPath, "fetch", "origin", pr.headRefName]).pipe(Effect.ignore)

					yield* runner
						.run("git", ["-C", repoPath, "worktree", "add", worktreePath, pr.headRefName])
						.pipe(
							Effect.mapError(
								(e) => new WorktreeError({ prKey, cause: e, message: `Failed to create worktree: ${e.detail}` }),
							),
						)

					yield* Effect.tryPromise({
						try: () => mkdir(join(worktreePath, ".ghui-review"), { recursive: true }),
						catch: (cause) => new WorktreeError({ prKey, cause, message: "Failed to create .ghui-review directory" }),
					})

					const entry: ReviewWorktree = {
						prKey,
						worktreePath,
						branchName: pr.headRefName,
						createdAt: new Date(),
					}

					yield* cache.upsertWorktree(entry)
					return entry
				})

			const remove = (prKey: string): Effect.Effect<void, WorktreeError> =>
				Effect.gen(function* () {
					const worktrees = yield* cache
						.listWorktrees()
						.pipe(
							Effect.mapError(
								(cause) => new WorktreeError({ prKey, cause, message: "Failed to list worktrees" }),
							),
						)
					const entry = worktrees.find((w) => w.prKey === prKey)
					if (!entry) return

				const repository = prKey.split("#")[0] ?? ""
				const repoPath = config.jsonConfig.repoMappings?.[repository]
				if (repoPath) {
					yield* runner.run("git", ["-C", repoPath, "worktree", "remove", "--force", entry.worktreePath]).pipe(Effect.ignore)
				}
				yield* cache.deleteWorktree(prKey)
				})

			const list = (): Effect.Effect<readonly ReviewWorktree[], WorktreeError> =>
				cache
					.listWorktrees()
					.pipe(
						Effect.mapError(
							(cause) => new WorktreeError({ prKey: "", cause, message: "Failed to list worktrees" }),
						),
					)

			const getWorktreePath = (prKey: string): Effect.Effect<string | null, WorktreeError> =>
				cache
					.listWorktrees()
					.pipe(
						Effect.map((worktrees) => worktrees.find((w) => w.prKey === prKey)?.worktreePath ?? null),
						Effect.mapError(
							(cause) => new WorktreeError({ prKey, cause, message: "Failed to get worktree path" }),
						),
					)

			return WorktreeService.of({ create, remove, list, getWorktreePath })
		}),
	)
}
