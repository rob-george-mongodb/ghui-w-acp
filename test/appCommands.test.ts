import { describe, expect, test } from "bun:test"
import { buildAppCommands } from "../src/appCommands.js"
import type { PullRequestItem } from "../src/domain.js"

const activeView = { _tag: "Queue", mode: "review", repository: null } as const
const selectedPullRequest: PullRequestItem = {
	repository: "owner/repo",
	author: "kit",
	headRefOid: "abc123",
	number: 42,
	title: "Review UX",
	body: "",
	labels: [],
	additions: 1,
	deletions: 1,
	changedFiles: 2,
	state: "open",
	reviewStatus: "review",
	checkStatus: "passing",
	checkSummary: "1/1",
	checks: [],
	autoMergeEnabled: false,
	detailLoaded: true,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	closedAt: null,
	url: "https://github.com/owner/repo/pull/42",
}

const noop = () => {}

const buildCommands = (overrides: Partial<Parameters<typeof buildAppCommands>[0]> = {}) =>
	buildAppCommands({
		pullRequestStatus: "ready",
		filterQuery: "",
		filterMode: false,
		selectedRepository: null,
		activeViews: [activeView],
		activeView,
		loadedPullRequestCount: 1,
		hasMorePullRequests: false,
		isLoadingMorePullRequests: false,
		selectedPullRequest,
		detailFullView: false,
		diffFullView: true,
		diffReady: true,
		effectiveDiffRenderView: "split",
		diffWrapMode: "none",
		diffWhitespaceMode: "ignore",
		readyDiffFileCount: 2,
		diffFileIndex: 0,
		diffRangeActive: false,
		selectedDiffCommentAnchorLabel: "→ +1",
		selectedDiffCommentThreadCount: 0,
		hasDiffCommentThreads: false,
		actions: {
			openCommandPalette: noop,
			refreshPullRequests: noop,
			openFilter: noop,
			clearFilter: noop,
			openThemeModal: noop,
			openRepositoryPicker: noop,
			loadMorePullRequests: noop,
			switchViewTo: noop,
			openDetails: noop,
			closeDetails: noop,
			openDiffView: noop,
			closeDiffView: noop,
			reloadDiff: noop,
			toggleDiffRenderView: noop,
			toggleDiffWrapMode: noop,
			toggleDiffWhitespaceMode: noop,
			openChangedFilesModal: noop,
			jumpDiffFile: noop,
			openSelectedDiffComment: noop,
			toggleDiffCommentRange: noop,
			moveDiffCommentThread: noop,
			openDiffCommentModal: noop,
			openSubmitReviewModal: noop,
			togglePullRequestDraftStatus: noop,
			openLabelModal: noop,
			openMergeModal: noop,
			openCloseModal: noop,
			openPullRequestInBrowser: noop,
			copyPullRequestMetadata: noop,
			quit: noop,
		},
		...overrides,
	})

const commandById = (id: string, overrides?: Partial<Parameters<typeof buildAppCommands>[0]>) => {
	const command = buildCommands(overrides).find((entry) => entry.id === id)
	if (!command) throw new Error(`Missing command ${id}`)
	return command
}

describe("review UX commands", () => {
	test("changed-files navigator is available from a ready diff", () => {
		const command = commandById("diff.changed-files")

		expect(command.shortcut).toBe("f")
		expect(command.disabledReason).toBeFalsy()
	})

	test("changed-files navigator is disabled when no files are loaded", () => {
		expect(commandById("diff.changed-files", { readyDiffFileCount: 0 }).disabledReason).toBe("No changed files loaded.")
	})

	test("submit-review command is available from an open pull request", () => {
		const command = commandById("pull.submit-review", { diffFullView: false, diffReady: false })

		expect(command.shortcut).toBe("shift-r")
		expect(command.disabledReason).toBeFalsy()
	})

	test("submit-review command requires an open pull request", () => {
		expect(
			commandById("pull.submit-review", {
				selectedPullRequest: { ...selectedPullRequest, state: "closed" },
			}).disabledReason,
		).toBe("Pull request is not open.")
	})
})
