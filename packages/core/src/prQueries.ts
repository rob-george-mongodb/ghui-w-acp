import type { PullRequestItem } from "./domain.js"
import { mergeCachedDetails } from "./pullRequestCache.js"

export const appendPullRequestPage = (existing: readonly PullRequestItem[], incoming: readonly PullRequestItem[]): readonly PullRequestItem[] => {
	const seen = new Set(existing.map((pr) => pr.url))
	const merged = mergeCachedDetails(incoming, existing)
	return [...existing, ...merged.filter((pr) => !seen.has(pr.url))]
}

export const PR_FETCH_RETRIES = 6
