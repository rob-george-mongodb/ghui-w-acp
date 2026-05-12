import { Schema } from "effect"

export type LoadStatus = "loading" | "ready" | "error"

export const pullRequestStates = ["open", "closed", "merged"] as const
export type PullRequestState = (typeof pullRequestStates)[number]

export const pullRequestQueueModes = ["authored", "review", "assigned", "mentioned", "inbox"] as const
export type PullRequestUserQueueMode = (typeof pullRequestQueueModes)[number]
export type PullRequestQueueMode = "repository" | PullRequestUserQueueMode

export const pullRequestQueueLabels = {
	repository: "repository",
	authored: "authored",
	review: "review requested",
	assigned: "assigned",
	mentioned: "mentioned",
	inbox: "inbox",
} as const satisfies Record<PullRequestQueueMode, string>

export const pullRequestQueueSearchQualifier = (mode: PullRequestQueueMode, repository: string | null) => {
	const qualifiers = {
		repository: repository ? `repo:${repository}` : "author:@me",
		authored: "author:@me",
		review: "review-requested:@me",
		assigned: "assignee:@me",
		mentioned: "mentions:@me",
		inbox: "author:@me",
	} as const satisfies Record<PullRequestQueueMode, string>
	const qualifier = qualifiers[mode]
	return mode === "repository" && repository ? qualifier : `${qualifier} archived:false`
}

export const checkConclusions = ["success", "failure", "neutral", "skipped", "cancelled", "timed_out"] as const
export type CheckConclusion = (typeof checkConclusions)[number]

export const checkRunStatuses = ["completed", "in_progress", "queued", "pending"] as const
export type CheckRunStatus = (typeof checkRunStatuses)[number]

export const checkRollupStatuses = ["passing", "pending", "failing", "none"] as const
export type CheckRollupStatus = (typeof checkRollupStatuses)[number]

export const reviewStatuses = ["draft", "approved", "changes", "review", "none"] as const
export type ReviewStatus = (typeof reviewStatuses)[number]

export type Mergeable = "mergeable" | "conflicting" | "unknown"

// DiffCommentSide is the only literal type still consumed at runtime — GitHubService
// uses it as a Schema inside PullRequestCommentSchema.
export const DiffCommentSide = Schema.Literals(["LEFT", "RIGHT"])
export type DiffCommentSide = Schema.Schema.Type<typeof DiffCommentSide>

export const pullRequestMergeMethods = ["squash", "merge", "rebase"] as const
export type PullRequestMergeMethod = (typeof pullRequestMergeMethods)[number]

export const pullRequestMergeKinds = ["now", "auto", "admin", "disable-auto"] as const
export type PullRequestMergeKind = (typeof pullRequestMergeKinds)[number]
export type PullRequestMergeMethodKind = Exclude<PullRequestMergeKind, "disable-auto">

export type PullRequestMergeAction =
	| {
			readonly kind: PullRequestMergeMethodKind
			readonly method: PullRequestMergeMethod
	  }
	| {
			readonly kind: "disable-auto"
	  }

export interface RepositoryMergeMethods {
	readonly squash: boolean
	readonly merge: boolean
	readonly rebase: boolean
}

export const allowedMergeMethodList = (allowed: RepositoryMergeMethods): readonly PullRequestMergeMethod[] => pullRequestMergeMethods.filter((method) => allowed[method])

export const pullRequestReviewEvents = ["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const
export type PullRequestReviewEvent = (typeof pullRequestReviewEvents)[number]

export interface CheckItem {
	readonly name: string
	readonly status: CheckRunStatus
	readonly conclusion: CheckConclusion | null
}

export interface PullRequestLabel {
	readonly name: string
	readonly color: string | null
}

export interface CreatePullRequestCommentInput {
	readonly repository: string
	readonly number: number
	readonly commitId: string
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly startLine?: number
	readonly startSide?: DiffCommentSide
	readonly body: string
}

export interface SubmitPullRequestReviewInput {
	readonly repository: string
	readonly number: number
	readonly event: PullRequestReviewEvent
	readonly body: string
}

export interface PullRequestReviewComment {
	readonly id: string
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly author: string
	readonly body: string
	readonly createdAt: Date | null
	readonly url: string | null
	readonly inReplyTo: string | null
	readonly outdated: boolean
}

export type PullRequestComment =
	| {
			readonly _tag: "comment"
			readonly id: string
			readonly author: string
			readonly body: string
			readonly createdAt: Date | null
			readonly url: string | null
	  }
	| ({ readonly _tag: "review-comment" } & PullRequestReviewComment)

export const isReviewComment = (comment: PullRequestComment): comment is PullRequestComment & { readonly _tag: "review-comment" } => comment._tag === "review-comment"
export const isIssueComment = (comment: PullRequestComment): comment is PullRequestComment & { readonly _tag: "comment" } => comment._tag === "comment"

export interface PullRequestItem {
	readonly repository: string
	readonly author: string
	readonly headRefOid: string
	readonly headRefName: string
	readonly number: number
	readonly title: string
	readonly body: string
	readonly labels: readonly PullRequestLabel[]
	readonly additions: number
	readonly deletions: number
	readonly changedFiles: number
	readonly state: PullRequestState
	readonly reviewStatus: ReviewStatus
	readonly checkStatus: CheckRollupStatus
	readonly checkSummary: string | null
	readonly checks: readonly CheckItem[]
	readonly autoMergeEnabled: boolean
	readonly detailLoaded: boolean
	readonly createdAt: Date
	readonly closedAt: Date | null
	readonly updatedAt: Date
	readonly totalCommentsCount: number
	readonly mergeable: Mergeable | null
	readonly assignees: readonly { readonly login: string }[]
	readonly reviewRequests: readonly { readonly type: "user" | "team"; readonly name: string }[]
	readonly url: string
}

export interface PullRequestPage {
	readonly items: readonly PullRequestItem[]
	readonly endCursor: string | null
	readonly hasNextPage: boolean
}

export interface ListPullRequestPageInput {
	readonly mode: PullRequestQueueMode
	readonly repository: string | null
	readonly cursor: string | null
	readonly pageSize: number
}

export interface PullRequestMergeInfo {
	readonly repository: string
	readonly number: number
	readonly title: string
	readonly state: PullRequestState
	readonly isDraft: boolean
	readonly mergeable: Mergeable
	readonly reviewStatus: ReviewStatus
	readonly checkStatus: CheckRollupStatus
	readonly checkSummary: string | null
	readonly autoMergeEnabled: boolean
	readonly viewerCanMergeAsAdmin: boolean
}

export const findingSeverities = ["info", "warning", "error", "blocking"] as const
export type FindingSeverity = (typeof findingSeverities)[number]

export const findingStatuses = ["pending_review", "accepted", "rejected", "modified"] as const
export type FindingStatus = (typeof findingStatuses)[number]

export const findingSources = ["ai", "human"] as const
export type FindingSource = (typeof findingSources)[number]

export const reviewVerdicts = ["indeterminate_human_review_required", "good_for_merge", "block_merge", "minor_issues"] as const
export type ReviewVerdict = (typeof reviewVerdicts)[number]

export const reviewSessionTypes = ["review", "chat"] as const
export type ReviewSessionType = (typeof reviewSessionTypes)[number]

export const sessionMessageRoles = ["user", "assistant"] as const
export type SessionMessageRole = (typeof sessionMessageRoles)[number]

export interface ReviewFinding {
	readonly id: string
	readonly prKey: string
	readonly sessionId: string | null
	readonly headRefOid: string
	readonly source: FindingSource
	readonly filePath: string | null
	readonly lineStart: number | null
	readonly lineEnd: number | null
	readonly diffSide: DiffCommentSide | null
	readonly title: string | null
	readonly body: string
	readonly severity: FindingSeverity | null
	readonly status: FindingStatus
	readonly modifiedBody: string | null
	readonly postedUrl: string | null
	readonly createdAt: Date
	readonly updatedAt: Date
}

export interface ReviewSession {
	readonly sessionId: string
	readonly prKey: string
	readonly worktreePath: string
	readonly sessionType: ReviewSessionType
	readonly agentName: string
	readonly startedAt: Date
	readonly endedAt: Date | null
	readonly stopReason: string | null
}

export interface SessionMessage {
	readonly id: string
	readonly sessionId: string
	readonly role: SessionMessageRole
	readonly content: string
	readonly createdAt: Date
}

export interface ReviewReport {
	readonly sessionId: string
	readonly prKey: string
	readonly verdict: ReviewVerdict
	readonly reportMd: string
	readonly canonicalPath: string
	readonly submittedAt: Date
}

export interface ReviewWorktree {
	readonly prKey: string
	readonly worktreePath: string
	readonly branchName: string
	readonly createdAt: Date
}

export interface TrackedComment {
	readonly commentId: string
	readonly prKey: string
	readonly resolved: boolean
	readonly resolvedAt: Date | null
	readonly createdAt: Date
}
