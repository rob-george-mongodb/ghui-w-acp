import { Schema } from "effect"

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

export const DiffCommentSide = Schema.Literals(["LEFT", "RIGHT"])
export type DiffCommentSide = Schema.Schema.Type<typeof DiffCommentSide>

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
