import type { PullRequestComment } from "./domain.js"

export const QUOTE_HEADER_RE = /^>\s*@(\S+)\s+wrote:\s*\n((?:>[^\n]*(?:\n|$))+)/

export const stripQuoteHeader = (body: string): string => {
	const match = QUOTE_HEADER_RE.exec(body)
	if (!match) return body
	return body.slice(match[0].length).replace(/^\n+/, "")
}

export const MAX_INDENT_LEVELS = 3

export const collapseWhitespace = (text: string): string =>
	text
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0)
		.join("\n")
		.trim()

export const issueQuoteParent = (
	comment: PullRequestComment & { readonly _tag: "comment" },
	candidates: readonly PullRequestComment[],
	collapsedById: Map<string, string>,
): string | null => {
	const match = QUOTE_HEADER_RE.exec(comment.body)
	if (!match) return null
	const author = match[1] ?? ""
	const quoted = collapseWhitespace(
		(match[2] ?? "")
			.split("\n")
			.map((line) => line.replace(/^>\s?/, ""))
			.join("\n"),
	)
	if (quoted.length === 0) return null
	for (const candidate of candidates) {
		if (candidate.id === comment.id) continue
		if (candidate._tag !== "comment") continue
		if (candidate.author !== author) continue
		const body = collapsedById.get(candidate.id) ?? ""
		if (body.length === 0) continue
		if (body === quoted || body.startsWith(quoted) || quoted.startsWith(body)) return candidate.id
	}
	return null
}

export interface OrderedComment {
	readonly comment: PullRequestComment
	readonly indent: number
}

export const orderCommentsForDisplay = (comments: readonly PullRequestComment[]): readonly OrderedComment[] => {
	const byId = new Map<string, PullRequestComment>()
	const collapsedIssueBodies = new Map<string, string>()
	for (const comment of comments) {
		byId.set(comment.id, comment)
		if (comment._tag === "comment") collapsedIssueBodies.set(comment.id, collapseWhitespace(comment.body))
	}

	const parentIdFor = (comment: PullRequestComment): string | null => {
		if (comment._tag === "review-comment") return comment.inReplyTo
		return issueQuoteParent(comment, comments, collapsedIssueBodies)
	}

	const childrenByParent = new Map<string, PullRequestComment[]>()
	const roots: PullRequestComment[] = []
	for (const comment of comments) {
		const parentId = parentIdFor(comment)
		if (parentId && byId.has(parentId)) {
			const list = childrenByParent.get(parentId) ?? []
			list.push(comment)
			childrenByParent.set(parentId, list)
		} else {
			roots.push(comment)
		}
	}

	const byTime = (left: PullRequestComment, right: PullRequestComment) => (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
	const ordered: { readonly comment: PullRequestComment; readonly indent: number }[] = []
	const visited = new Set<string>()
	const visit = (comment: PullRequestComment, indent: number): void => {
		if (visited.has(comment.id)) return
		visited.add(comment.id)
		ordered.push({ comment, indent: Math.min(indent, MAX_INDENT_LEVELS) })
		const children = (childrenByParent.get(comment.id) ?? []).slice().sort(byTime)
		for (const child of children) visit(child, indent + 1)
	}
	for (const root of roots) visit(root, 0)
	return ordered
}

export const findReviewThreadRootId = (comments: readonly PullRequestComment[], commentId: string): string => {
	const reviewById = new Map<string, PullRequestComment & { readonly _tag: "review-comment" }>()
	for (const entry of comments) if (entry._tag === "review-comment") reviewById.set(entry.id, entry)
	let cursor = reviewById.get(commentId)
	const seen = new Set<string>()
	while (cursor && cursor.inReplyTo && !seen.has(cursor.id)) {
		seen.add(cursor.id)
		const parent = reviewById.get(cursor.inReplyTo)
		if (!parent) break
		cursor = parent
	}
	return cursor?.id ?? commentId
}
