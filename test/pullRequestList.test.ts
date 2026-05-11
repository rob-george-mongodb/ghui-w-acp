import { describe, expect, test } from "bun:test"
import type { PullRequestItem } from "@ghui/core"
import { buildPullRequestListRows } from "../src/ui/PullRequestList.tsx"

const pullRequest = (overrides: Partial<PullRequestItem> = {}): PullRequestItem => ({
	repository: "owner/repo",
	author: "author",
	headRefOid: "abc123",
	headRefName: "feature/pagination",
	number: 1,
	title: "Update pagination",
	body: "",
	labels: [],
	additions: 0,
	deletions: 0,
	changedFiles: 0,
	state: "open",
	reviewStatus: "none",
	checkStatus: "none",
	checkSummary: null,
	checks: [],
	autoMergeEnabled: false,
	detailLoaded: false,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	totalCommentsCount: 0,
	mergeable: null,
	assignees: [],
	reviewRequests: [],
	closedAt: null,
	url: "https://github.com/owner/repo/pull/1",
	...overrides,
})

describe("buildPullRequestListRows", () => {
	test("shows a loaded-count footer when more pull requests are available", () => {
		const rows = buildPullRequestListRows({
			groups: [["owner/repo", [pullRequest()]]],
			status: "ready",
			error: null,
			filterText: "",
			showFilterBar: false,
			loadedCount: 50,
			hasMore: true,
			isLoadingMore: false,
		})

		expect(rows.at(-1)).toEqual({ _tag: "load-more", text: "- 50 loaded, more available" })
	})

	test("shows an in-progress footer while loading the next page", () => {
		const rows = buildPullRequestListRows({
			groups: [["owner/repo", [pullRequest()]]],
			status: "ready",
			error: null,
			filterText: "",
			showFilterBar: false,
			loadedCount: 50,
			hasMore: true,
			isLoadingMore: true,
			loadingIndicator: "⠋",
		})

		expect(rows.at(-1)).toEqual({ _tag: "load-more", text: "⠋ Loading more pull requests... (50 loaded)" })
	})

	test("inbox groupKind emits inbox-section group rows", () => {
		const rows = buildPullRequestListRows({
			groups: [["Needs your review", [pullRequest()]]],
			status: "ready",
			error: null,
			filterText: "",
			showFilterBar: false,
			loadedCount: 1,
			hasMore: false,
			isLoadingMore: false,
			groupKind: "inbox-section",
		})

		const groupRow = rows.find((r) => r._tag === "group")
		expect(groupRow).toBeDefined()
		expect(groupRow!.kind).toBe("inbox-section")
	})

	test("inbox groupKind emits pr rows with kind inbox and zero ageWidth", () => {
		const rows = buildPullRequestListRows({
			groups: [["Needs your review", [pullRequest()]]],
			status: "ready",
			error: null,
			filterText: "",
			showFilterBar: false,
			loadedCount: 1,
			hasMore: false,
			isLoadingMore: false,
			groupKind: "inbox-section",
		})

		const prRow = rows.find((r) => r._tag === "pull-request")
		expect(prRow).toBeDefined()
		expect(prRow!.kind).toBe("inbox")
		expect(prRow!.ageWidth).toBe(0)
	})

	test("repository groupKind emits pr rows with positive ageWidth", () => {
		const rows = buildPullRequestListRows({
			groups: [["owner/repo", [pullRequest()]]],
			status: "ready",
			error: null,
			filterText: "",
			showFilterBar: false,
			loadedCount: 1,
			hasMore: false,
			isLoadingMore: false,
		})

		const prRow = rows.find((r) => r._tag === "pull-request")
		expect(prRow).toBeDefined()
		expect(prRow!.kind).toBe("repository")
		expect(prRow!.ageWidth).toBeGreaterThan(0)
	})
})
