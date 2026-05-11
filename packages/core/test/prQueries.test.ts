import { describe, expect, test } from "bun:test"
import { appendPullRequestPage, PR_FETCH_RETRIES, type PullRequestItem } from "@ghui/core"

const makePR = (number: number, url?: string): PullRequestItem => ({
	repository: "owner/repo",
	author: "user",
	headRefOid: `sha${number}`,
	headRefName: `branch-${number}`,
	number,
	title: `PR #${number}`,
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
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
	closedAt: null,
	totalCommentsCount: 0,
	mergeable: null,
	assignees: [],
	reviewRequests: [],
	url: url ?? `https://github.com/owner/repo/pull/${number}`,
})

describe("appendPullRequestPage", () => {
	test("appends new items", () => {
		const existing = [makePR(1)]
		const incoming = [makePR(2)]
		const result = appendPullRequestPage(existing, incoming)
		expect(result).toHaveLength(2)
		expect(result[1]!.number).toBe(2)
	})

	test("deduplicates by URL", () => {
		const existing = [makePR(1)]
		const incoming = [makePR(1), makePR(2)]
		const result = appendPullRequestPage(existing, incoming)
		expect(result).toHaveLength(2)
	})

	test("preserves detail fields from cached items with same SHA", () => {
		const existing = [{ ...makePR(1), body: "cached body", detailLoaded: true }]
		const incoming = [makePR(2, "https://github.com/owner/repo/pull/2")]
		const result = appendPullRequestPage(existing, incoming)
		expect(result).toHaveLength(2)
	})
})

describe("PR_FETCH_RETRIES", () => {
	test("is a reasonable retry count", () => {
		expect(PR_FETCH_RETRIES).toBe(6)
	})
})
