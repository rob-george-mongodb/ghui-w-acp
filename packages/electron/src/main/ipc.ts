import { ipcMain } from "electron"
import { Cause, Effect, Exit, ManagedRuntime } from "effect"
import { BrowserOpener, CacheService, Clipboard, CommandRunner, GitHubService, type AppConfig, AppConfigService } from "@ghui/core/node"
import type { PullRequestView } from "@ghui/core/node"
import type { IpcChannel, IpcChannels, IpcError, IpcResult } from "../shared/ipcProtocol.js"
import { makeElectronCoreLayer } from "./coreLayer.js"

const serializeError = (error: unknown): IpcError => {
	if (error && typeof error === "object" && "_tag" in error) {
		const tagged = error as { _tag: string; detail?: string; message?: string; retryAfterSeconds?: number | null }
		return {
			_tag: tagged._tag,
			message: tagged.detail ?? tagged.message ?? String(error),
			retryAfterSeconds: tagged.retryAfterSeconds ?? undefined,
		}
	}
	return { _tag: "UnknownError", message: String(error) }
}

export const setupIpcHandlers = (appConfig: AppConfig) => {
	const coreLayer = makeElectronCoreLayer({ appConfig })
	const runtime = ManagedRuntime.make(coreLayer)

	const handle = <C extends IpcChannel>(channel: C, handler: (...args: IpcChannels[C]["args"]) => Effect.Effect<IpcChannels[C]["result"], any, any>) => {
		ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResult<IpcChannels[C]["result"]>> => {
			try {
				const data = await runtime.runPromise(handler(...(args as IpcChannels[C]["args"])))
				return { success: true, data }
			} catch (error) {
				return { success: false, error: serializeError(error) }
			}
		})
	}

	handle("pr:list", (view: PullRequestView, cursor?: string | null, pageSize?: number) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			const mode = view._tag === "Repository" ? ("repository" as const) : view.mode
			const repo = view.repository
			return yield* github.listOpenPullRequestPage({ mode, repository: repo, cursor: cursor ?? null, pageSize: pageSize ?? 50 })
		}),
	)

	handle("pr:details", (repo, number) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.getPullRequestDetails(repo, number)
		}),
	)

	handle("pr:comments", (repo, number) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.listPullRequestComments(repo, number)
		}),
	)

	handle("pr:mergeInfo", (repo, number) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.getPullRequestMergeInfo(repo, number)
		}),
	)

	handle("pr:merge", (repo, number, action) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.mergePullRequest(repo, number, action)
		}),
	)

	handle("pr:close", (repo, number) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.closePullRequest(repo, number)
		}),
	)

	handle("pr:review", (input) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.submitPullRequestReview(input)
		}),
	)

	handle("pr:toggleDraft", (repo, number, isDraft) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.toggleDraftStatus(repo, number, isDraft)
		}),
	)

	handle("pr:labels:list", (repo) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.listRepoLabels(repo)
		}),
	)

	handle("pr:labels:add", (repo, number, label) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.addPullRequestLabel(repo, number, label)
		}),
	)

	handle("pr:labels:remove", (repo, number, label) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.removePullRequestLabel(repo, number, label)
		}),
	)

	handle("pr:mergeMethods", (repo) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.getRepositoryMergeMethods(repo)
		}),
	)

	handle("pr:issueComment:create", (repo, number, body) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.createPullRequestIssueComment(repo, number, body)
		}),
	)

	handle("pr:comment:create", (input) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			return yield* github.createPullRequestComment(input)
		}),
	)

	handle("pr:comment:edit", (repo, commentId, body) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.editReviewComment(repo, commentId, body)
		}),
	)

	handle("pr:comment:delete", (repo, commentId) =>
		Effect.gen(function* () {
			const github = yield* GitHubService
			yield* github.deleteReviewComment(repo, commentId)
		}),
	)

	handle("clipboard:copy", (text) =>
		Effect.gen(function* () {
			const clipboard = yield* Clipboard
			yield* clipboard.copy(text)
		}),
	)

	handle("browser:open", (url) =>
		Effect.gen(function* () {
			const browser = yield* BrowserOpener
			yield* browser.openUrl(url)
		}),
	)

	handle("cache:readQueue", (viewer, view) =>
		Effect.gen(function* () {
			const cache = yield* CacheService
			return yield* cache.readQueue(viewer, view)
		}),
	)

	handle("config:get", () =>
		Effect.gen(function* () {
			const config = yield* AppConfigService
			return config
		}),
	)

	handle("auth:user", () =>
		Effect.gen(function* () {
			const command = yield* CommandRunner
			const result = yield* command.run("gh", ["api", "user", "--jq", ".login"])
			return result.stdout.trim()
		}),
	)

	handle("auth:check", () =>
		Effect.gen(function* () {
			const command = yield* CommandRunner
			const result = yield* command.run("gh", ["auth", "status"]).pipe(Effect.exit)
			if (Exit.isSuccess(result)) return { ok: true as const }
			const pretty = Cause.pretty(result.cause)
			return { ok: false as const, error: pretty }
		}),
	)

	return { runtime }
}
