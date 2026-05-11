import { describe, expect, test } from "bun:test"
import { pullRequestQueueSearchQualifier, viewCacheKey } from "@ghui/core"

describe("pullRequestQueueSearchQualifier", () => {
	test("repository mode with repository → repo: qualifier", () => {
		expect(pullRequestQueueSearchQualifier("repository", "owner/name")).toBe("repo:owner/name")
	})

	test("repository mode without repository falls back to @me and excludes archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("repository", null)).toBe("author:@me archived:false")
	})

	test("authored mode → author:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("authored", null)).toBe("author:@me archived:false")
	})

	test("review mode → review-requested:@me excluding archived repositories regardless of repository", () => {
		expect(pullRequestQueueSearchQualifier("review", "owner/name")).toBe("review-requested:@me archived:false")
	})

	test("assigned mode → assignee:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("assigned", null)).toBe("assignee:@me archived:false")
	})

	test("mentioned mode → mentions:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("mentioned", null)).toBe("mentions:@me archived:false")
	})

	test("inbox mode → author:@me excluding archived repositories", () => {
		expect(pullRequestQueueSearchQualifier("inbox", null)).toBe("author:@me archived:false")
	})
})

describe("viewCacheKey", () => {
	test("repository view key includes repo path", () => {
		expect(viewCacheKey({ _tag: "Repository", repository: "owner/name" })).toBe("repository:owner/name")
	})

	test("queue view key is the mode literal", () => {
		expect(viewCacheKey({ _tag: "Queue", mode: "authored", repository: null })).toBe("authored")
		expect(viewCacheKey({ _tag: "Queue", mode: "review", repository: "owner/name" })).toBe("review")
	})

	test("inbox queue view key is 'inbox'", () => {
		expect(viewCacheKey({ _tag: "Queue", mode: "inbox", repository: null })).toBe("inbox")
	})
})
