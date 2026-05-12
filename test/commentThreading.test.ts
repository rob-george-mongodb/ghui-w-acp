import { describe, expect, test } from "bun:test"
import type { PullRequestComment } from "@ghui/core"
import { QUOTE_HEADER_RE, collapseWhitespace, findReviewThreadRootId, orderCommentsForDisplay, stripQuoteHeader } from "@ghui/core"

const issueComment = (id: string, author: string, body: string, createdAt?: Date): PullRequestComment => ({
	_tag: "comment",
	id,
	author,
	body,
	createdAt: createdAt ?? new Date(0),
	url: null,
})

const reviewComment = (id: string, author: string, body: string, opts: { path?: string; line?: number; inReplyTo?: string; createdAt?: Date } = {}): PullRequestComment => ({
	_tag: "review-comment",
	id,
	path: opts.path ?? "file.ts",
	line: opts.line ?? 1,
	side: "RIGHT",
	author,
	body,
	createdAt: opts.createdAt ?? new Date(0),
	url: null,
	inReplyTo: opts.inReplyTo ?? null,
	outdated: false,
})

describe("collapseWhitespace", () => {
	test("collapses multiple blank lines", () => {
		expect(collapseWhitespace("hello\n\n\nworld")).toBe("hello\nworld")
	})

	test("trims trailing whitespace on lines", () => {
		expect(collapseWhitespace("hello   \nworld  ")).toBe("hello\nworld")
	})

	test("returns empty string for empty input", () => {
		expect(collapseWhitespace("")).toBe("")
		expect(collapseWhitespace("   \n\n  ")).toBe("")
	})
})

describe("QUOTE_HEADER_RE", () => {
	test("matches quote header pattern", () => {
		const text = "> @alice wrote:\n> some quoted text\n> more text"
		expect(QUOTE_HEADER_RE.test(text)).toBe(true)
	})

	test("does not match non-quote text", () => {
		expect(QUOTE_HEADER_RE.test("just a regular comment")).toBe(false)
		expect(QUOTE_HEADER_RE.test("> no author wrote pattern")).toBe(false)
	})
})

describe("stripQuoteHeader", () => {
	test("strips quote header and returns remaining text", () => {
		const body = "> @alice wrote:\n> quoted line\n\nmy reply"
		expect(stripQuoteHeader(body)).toBe("my reply")
	})

	test("returns original body if no quote header", () => {
		const body = "just a comment"
		expect(stripQuoteHeader(body)).toBe("just a comment")
	})
})

describe("orderCommentsForDisplay", () => {
	test("flat comments preserve order", () => {
		const comments = [issueComment("1", "alice", "first", new Date(1000)), issueComment("2", "bob", "second", new Date(2000))]
		const result = orderCommentsForDisplay(comments)
		expect(result.map((r) => r.comment.id)).toEqual(["1", "2"])
		expect(result.map((r) => r.indent)).toEqual([0, 0])
	})

	test("review comment thread groups replies under parent", () => {
		const comments = [
			reviewComment("root", "alice", "parent comment", { createdAt: new Date(1000) }),
			reviewComment("reply1", "bob", "reply", { inReplyTo: "root", createdAt: new Date(2000) }),
			reviewComment("reply2", "carol", "reply2", { inReplyTo: "root", createdAt: new Date(3000) }),
		]
		const result = orderCommentsForDisplay(comments)
		expect(result.map((r) => r.comment.id)).toEqual(["root", "reply1", "reply2"])
		expect(result.map((r) => r.indent)).toEqual([0, 1, 1])
	})

	test("issue comment quote threading nests reply under quoted parent", () => {
		const comments = [issueComment("1", "alice", "original message", new Date(1000)), issueComment("2", "bob", "> @alice wrote:\n> original message\n\nmy reply", new Date(2000))]
		const result = orderCommentsForDisplay(comments)
		expect(result.map((r) => r.comment.id)).toEqual(["1", "2"])
		expect(result.map((r) => r.indent)).toEqual([0, 1])
	})

	test("deep nesting capped at MAX_INDENT_LEVELS (3)", () => {
		const comments = [
			reviewComment("a", "alice", "root", { createdAt: new Date(1000) }),
			reviewComment("b", "bob", "r1", { inReplyTo: "a", createdAt: new Date(2000) }),
			reviewComment("c", "carol", "r2", { inReplyTo: "b", createdAt: new Date(3000) }),
			reviewComment("d", "dave", "r3", { inReplyTo: "c", createdAt: new Date(4000) }),
			reviewComment("e", "eve", "r4", { inReplyTo: "d", createdAt: new Date(5000) }),
		]
		const result = orderCommentsForDisplay(comments)
		expect(result.map((r) => r.indent)).toEqual([0, 1, 2, 3, 3])
	})

	test("DFS ordering with children sorted by time", () => {
		const comments = [
			reviewComment("root", "alice", "root", { createdAt: new Date(1000) }),
			reviewComment("child2", "carol", "later child", { inReplyTo: "root", createdAt: new Date(3000) }),
			reviewComment("child1", "bob", "earlier child", { inReplyTo: "root", createdAt: new Date(2000) }),
			reviewComment("grandchild", "dave", "gc", { inReplyTo: "child1", createdAt: new Date(2500) }),
		]
		const result = orderCommentsForDisplay(comments)
		expect(result.map((r) => r.comment.id)).toEqual(["root", "child1", "grandchild", "child2"])
	})

	test("cycle safety - self-referencing comment does not infinite loop", () => {
		const comments = [reviewComment("a", "alice", "self", { inReplyTo: "a", createdAt: new Date(1000) })]
		// Self-ref means it's a child of itself, never a root, so it's unreachable — but no infinite loop
		const result = orderCommentsForDisplay(comments)
		expect(result).toHaveLength(0)
	})

	test("cycle safety - mutual reference does not infinite loop", () => {
		const comments = [
			reviewComment("a", "alice", "a", { inReplyTo: "b", createdAt: new Date(1000) }),
			reviewComment("b", "bob", "b", { inReplyTo: "a", createdAt: new Date(2000) }),
		]
		// Both are children of each other, neither is a root — but no infinite loop
		const result = orderCommentsForDisplay(comments)
		expect(result).toHaveLength(0)
	})
})

describe("findReviewThreadRootId", () => {
	test("walks inReplyTo chain to find root", () => {
		const comments = [
			reviewComment("root", "alice", "root"),
			reviewComment("mid", "bob", "mid", { inReplyTo: "root" }),
			reviewComment("leaf", "carol", "leaf", { inReplyTo: "mid" }),
		]
		expect(findReviewThreadRootId(comments, "leaf")).toBe("root")
	})

	test("returns commentId itself if it is the root", () => {
		const comments = [reviewComment("root", "alice", "root")]
		expect(findReviewThreadRootId(comments, "root")).toBe("root")
	})

	test("returns commentId if comment not found in list", () => {
		expect(findReviewThreadRootId([], "missing")).toBe("missing")
	})

	test("handles cycle safely", () => {
		const comments = [reviewComment("a", "alice", "a", { inReplyTo: "b" }), reviewComment("b", "bob", "b", { inReplyTo: "a" })]
		const result = findReviewThreadRootId(comments, "a")
		expect(["a", "b"]).toContain(result)
	})
})
