import type { PullRequestItem } from "./domain.js"

export const mergeCachedDetails = (fresh: readonly PullRequestItem[], cached: readonly PullRequestItem[] | undefined) => {
	if (!cached) return fresh
	const cachedByUrl = new Map(cached.map((pullRequest) => [pullRequest.url, pullRequest]))
	return fresh.map((pullRequest) => {
		const cachedPullRequest = cachedByUrl.get(pullRequest.url)
		if (!cachedPullRequest?.detailLoaded || cachedPullRequest.headRefOid !== pullRequest.headRefOid) return pullRequest
		return {
			...pullRequest,
			body: cachedPullRequest.body,
			labels: cachedPullRequest.labels,
			additions: cachedPullRequest.additions,
			deletions: cachedPullRequest.deletions,
			changedFiles: cachedPullRequest.changedFiles,
			detailLoaded: true,
		} satisfies PullRequestItem
	})
}
