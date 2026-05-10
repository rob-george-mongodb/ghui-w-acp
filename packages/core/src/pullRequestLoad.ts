import type { PullRequestItem } from "./domain.js"
import type { PullRequestView } from "./pullRequestViews.js"

export interface PullRequestLoad {
	readonly view: PullRequestView
	readonly data: readonly PullRequestItem[]
	readonly fetchedAt: Date | null
	readonly endCursor: string | null
	readonly hasNextPage: boolean
}
