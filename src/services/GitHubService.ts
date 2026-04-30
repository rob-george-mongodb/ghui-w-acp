import { Context, Effect, Layer } from "effect"
import { config } from "../config.js"
import type { CheckItem, PullRequestItem } from "../domain.js"
import { CommandRunner, type CommandError, type JsonParseError } from "./CommandRunner.js"

interface GitHubListPullRequest {
	readonly number: number
	readonly title: string
	readonly body: string
	readonly labels: readonly {
		readonly name: string
		readonly color?: string | null
	}[]
	readonly additions: number
	readonly deletions: number
	readonly changedFiles: number
	readonly isDraft: boolean
	readonly reviewDecision: string
	readonly statusCheckRollup: readonly {
		readonly name?: string | null
		readonly context?: string | null
		readonly status?: string | null
		readonly conclusion?: string | null
		readonly state?: string | null
	}[]
	readonly state: string
	readonly createdAt: string
	readonly closedAt?: string | null
	readonly url: string
}

interface GitHubSearchPullRequest {
	readonly number: number
	readonly repository: {
		readonly nameWithOwner: string
	}
}

interface GitHubViewer {
	readonly login: string
}

const searchJsonFields = "repository,number"
const detailJsonFields = "number,title,body,labels,additions,deletions,changedFiles,isDraft,reviewDecision,statusCheckRollup,state,createdAt,closedAt,url"

const normalizeDate = (value: string | null | undefined) => {
	if (!value || value.startsWith("0001-01-01")) return null
	return new Date(value)
}

const getReviewStatus = (item: GitHubListPullRequest): PullRequestItem["reviewStatus"] => {
	if (item.isDraft) return "draft"
	if (item.reviewDecision === "APPROVED") return "approved"
	if (item.reviewDecision === "CHANGES_REQUESTED") return "changes"
	if (item.reviewDecision === "REVIEW_REQUIRED") return "review"
	return "none"
}

const normalizeCheckStatus = (raw?: string | null): CheckItem["status"] => {
	if (raw === "COMPLETED") return "completed"
	if (raw === "IN_PROGRESS") return "in_progress"
	if (raw === "QUEUED") return "queued"
	return "pending"
}

const normalizeCheckConclusion = (raw?: string | null): CheckItem["conclusion"] => {
	if (raw === "SUCCESS") return "success"
	if (raw === "FAILURE" || raw === "ERROR") return "failure"
	if (raw === "NEUTRAL") return "neutral"
	if (raw === "SKIPPED") return "skipped"
	if (raw === "CANCELLED") return "cancelled"
	if (raw === "TIMED_OUT") return "timed_out"
	return null
}

const getCheckInfo = (item: GitHubListPullRequest): Pick<PullRequestItem, "checkStatus" | "checkSummary" | "checks"> => {
	if (item.statusCheckRollup.length === 0) {
		return { checkStatus: "none", checkSummary: null, checks: [] }
	}

	let completed = 0
	let successful = 0
	let pending = false
	let failing = false
	const checks: CheckItem[] = []

	for (const check of item.statusCheckRollup) {
		const name = check.name ?? check.context ?? "check"

		checks.push({
			name,
			status: normalizeCheckStatus(check.status),
			conclusion: normalizeCheckConclusion(check.conclusion),
		})

		if (check.status === "COMPLETED") {
			completed += 1
		} else {
			pending = true
		}

		if (check.conclusion === "SUCCESS" || check.conclusion === "NEUTRAL" || check.conclusion === "SKIPPED") {
			successful += 1
		} else if (check.conclusion && check.conclusion !== "SUCCESS") {
			failing = true
		}
	}

	if (pending) {
		return { checkStatus: "pending", checkSummary: `checks ${completed}/${item.statusCheckRollup.length}`, checks }
	}

	if (failing) {
		return { checkStatus: "failing", checkSummary: `checks ${successful}/${item.statusCheckRollup.length}`, checks }
	}

	return { checkStatus: "passing", checkSummary: `checks ${successful}/${item.statusCheckRollup.length}`, checks }
}

const parsePullRequest = (repository: string, item: GitHubListPullRequest): PullRequestItem => {
	const checkInfo = getCheckInfo(item)

	return {
		repository,
		number: item.number,
		title: item.title,
		body: item.body,
		labels: item.labels.map((label) => ({
			name: label.name,
			color: label.color ? `#${label.color}` : null,
		})),
		additions: item.additions,
		deletions: item.deletions,
		changedFiles: item.changedFiles,
		state: item.state.toLowerCase() === "open" ? "open" : "closed",
		reviewStatus: getReviewStatus(item),
		checkStatus: checkInfo.checkStatus,
		checkSummary: checkInfo.checkSummary,
		checks: checkInfo.checks,
		createdAt: new Date(item.createdAt),
		closedAt: normalizeDate(item.closedAt),
		url: item.url,
	}
}

const searchOpenArgs = (author: string) => [
	"search",
	"prs",
	"--author",
	author,
	"--state",
	"open",
	"--limit",
	String(config.prFetchLimit),
	"--sort",
	"created",
	"--order",
	"desc",
	"--json",
	searchJsonFields,
] as const

type GitHubError = CommandError | JsonParseError

export class GitHubService extends Context.Service<GitHubService, {
	readonly listOpenPullRequests: () => Effect.Effect<readonly PullRequestItem[], GitHubError>
	readonly getAuthenticatedUser: () => Effect.Effect<string, GitHubError>
	readonly getPullRequestDiff: (repository: string, number: number) => Effect.Effect<string, CommandError>
	readonly toggleDraftStatus: (repository: string, number: number, isDraft: boolean) => Effect.Effect<void, CommandError>
	readonly listRepoLabels: (repository: string) => Effect.Effect<readonly { readonly name: string; readonly color: string | null }[], GitHubError>
	readonly addPullRequestLabel: (repository: string, number: number, label: string) => Effect.Effect<void, CommandError>
	readonly removePullRequestLabel: (repository: string, number: number, label: string) => Effect.Effect<void, CommandError>
}>()("ghui/GitHubService") {
	static readonly layerNoDeps = Layer.effect(
		GitHubService,
		Effect.gen(function*() {
			const command = yield* CommandRunner

			const listOpenPullRequests = Effect.fn("GitHubService.listOpenPullRequests")(function*() {
				const searchResults = yield* command.runJson<readonly GitHubSearchPullRequest[]>("gh", [...searchOpenArgs(config.author)])
				const pullRequests = yield* Effect.forEach(
					searchResults,
					Effect.fn("GitHubService.loadPullRequestDetail")(function*(searchResult) {
						const repository = searchResult.repository.nameWithOwner
						const pullRequest = yield* command.runJson<GitHubListPullRequest>("gh", [
							"pr", "view", String(searchResult.number), "--repo", repository, "--json", detailJsonFields,
						])
						return parsePullRequest(repository, pullRequest)
					}),
					{ concurrency: 8 },
				)

				return pullRequests.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
			})

			const getAuthenticatedUser = Effect.fn("GitHubService.getAuthenticatedUser")(function*() {
				const viewer = yield* command.runJson<GitHubViewer>("gh", ["api", "user"])
				return viewer.login
			})

			const getPullRequestDiff = Effect.fn("GitHubService.getPullRequestDiff")(function*(repository: string, number: number) {
				const result = yield* command.run("gh", ["pr", "diff", String(number), "--repo", repository, "--color", "never"])
				return result.stdout
			})

			const toggleDraftStatus = Effect.fn("GitHubService.toggleDraftStatus")(function*(repository: string, number: number, isDraft: boolean) {
				yield* command.run("gh", ["pr", "ready", String(number), "--repo", repository, ...(isDraft ? [] : ["--undo"])])
			})

			const listRepoLabels = Effect.fn("GitHubService.listRepoLabels")(function*(repository: string) {
				const labels = yield* command.runJson<readonly { name: string; color: string }[]>("gh", [
					"label", "list", "--repo", repository, "--json", "name,color", "--limit", "100",
				])
				return labels.map((label) => ({ name: label.name, color: `#${label.color}` }))
			})

			const addPullRequestLabel = Effect.fn("GitHubService.addPullRequestLabel")(function*(repository: string, number: number, label: string) {
				yield* command.run("gh", ["pr", "edit", String(number), "--repo", repository, "--add-label", label])
			})

			const removePullRequestLabel = Effect.fn("GitHubService.removePullRequestLabel")(function*(repository: string, number: number, label: string) {
				yield* command.run("gh", ["pr", "edit", String(number), "--repo", repository, "--remove-label", label])
			})

			return GitHubService.of({
				listOpenPullRequests,
				getAuthenticatedUser,
				getPullRequestDiff,
				toggleDraftStatus,
				listRepoLabels,
				addPullRequestLabel,
				removePullRequestLabel,
			})
		}),
	)

	static readonly layer = GitHubService.layerNoDeps.pipe(Layer.provide(CommandRunner.layer))
}
