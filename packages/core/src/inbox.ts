import type { PullRequestItem } from "./domain.js"

export type InboxSectionId = "review" | "drafts" | "needsAction" | "waiting"

export interface InboxSection {
	readonly id: InboxSectionId
	readonly title: string
}

export const INBOX_SECTIONS: Record<InboxSectionId, InboxSection> = {
	review: { id: "review", title: "Needs your review" },
	drafts: { id: "drafts", title: "Your drafts" },
	needsAction: { id: "needsAction", title: "Needs action" },
	waiting: { id: "waiting", title: "Waiting for review" },
}

export const INBOX_SECTION_ORDER: readonly InboxSectionId[] = ["review", "drafts", "needsAction", "waiting"]

export type PullRequestUpdatedSinceWindow = "1m" | "3m" | "1y" | "any"

export const inboxUpdatedSinceCutoff = (window: PullRequestUpdatedSinceWindow): string | null => {
	if (window === "any") return null
	const now = new Date()
	if (window === "1m") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10)
	if (window === "3m") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
	return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
}

export const classifyInboxSection = (pr: PullRequestItem, viewer: string | null): InboxSection => {
	if (viewer !== null && pr.reviewRequests.some((r) => r.type === "user" && r.name === viewer)) {
		return INBOX_SECTIONS.review
	}
	if (pr.author === viewer && pr.reviewStatus === "draft") {
		return INBOX_SECTIONS.drafts
	}
	if (pr.author === viewer && pr.reviewStatus === "changes") {
		return INBOX_SECTIONS.needsAction
	}
	return INBOX_SECTIONS.waiting
}
