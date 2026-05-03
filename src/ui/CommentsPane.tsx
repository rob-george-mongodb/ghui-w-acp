import { useEffect, useMemo, useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { PullRequestComment, PullRequestItem } from "../domain.js"
import { colors } from "./colors.js"
import { commentBodyRows, commentCountText, commentMetaSegments, type CommentDisplayLine } from "./comments.js"
import { centerCell, Divider, Filler, fitCell, HintRow, PaddedRow, PlainLine, TextLine, type HintItem } from "./primitives.js"
import { shortRepoName } from "./pullRequests.js"

const META_PREFIX_WIDTH = 2 // "• "
const PLACEHOLDER_KEY = "__placeholder_new_comment"

interface CommentBlock {
	readonly key: string
	readonly comment: PullRequestComment | null
	readonly meta: CommentDisplayLine
	readonly body: readonly CommentDisplayLine[]
	readonly height: number
	// Replies are indented one level under their thread root; null otherwise.
	readonly indent: 0 | 1
	readonly isPlaceholder: boolean
}

const reviewContextGroups = (comment: PullRequestComment, width: number): readonly (readonly { readonly text: string; readonly fg: string }[])[] => {
	if (comment._tag !== "review-comment") return []
	const lineSuffix = `:${comment.line}`
	const pathLabel = `${comment.path}${lineSuffix}`
	const room = Math.max(8, width - META_PREFIX_WIDTH - comment.author.length - 16)
	const truncated = pathLabel.length <= room ? pathLabel : `…${pathLabel.slice(-(room - 1))}`
	return [[{ text: truncated, fg: colors.inlineCode }]]
}

// Order comments so review-thread replies sit right after their root, while
// preserving overall createdAt order between roots and top-level comments.
const orderForThreads = (comments: readonly PullRequestComment[]): readonly { readonly comment: PullRequestComment; readonly indent: 0 | 1 }[] => {
	const reviewById = new Map<string, PullRequestComment & { readonly _tag: "review-comment" }>()
	for (const comment of comments) {
		if (comment._tag === "review-comment") reviewById.set(comment.id, comment)
	}

	const rootIdFor = (comment: PullRequestComment & { readonly _tag: "review-comment" }): string => {
		let cursor: (PullRequestComment & { readonly _tag: "review-comment" }) | undefined = comment
		const seen = new Set<string>()
		while (cursor && cursor.inReplyTo) {
			if (seen.has(cursor.id)) break
			seen.add(cursor.id)
			const parent = reviewById.get(cursor.inReplyTo)
			if (!parent) break
			cursor = parent
		}
		return cursor?.id ?? comment.id
	}

	const repliesByRoot = new Map<string, (PullRequestComment & { readonly _tag: "review-comment" })[]>()
	const roots: PullRequestComment[] = []
	for (const comment of comments) {
		if (comment._tag !== "review-comment") {
			roots.push(comment)
			continue
		}
		const rootId = rootIdFor(comment)
		if (rootId === comment.id) {
			roots.push(comment)
		} else {
			const list = repliesByRoot.get(rootId) ?? []
			list.push(comment)
			repliesByRoot.set(rootId, list)
		}
	}

	const ordered: { readonly comment: PullRequestComment; readonly indent: 0 | 1 }[] = []
	for (const root of roots) {
		ordered.push({ comment: root, indent: 0 })
		if (root._tag !== "review-comment") continue
		const replies = (repliesByRoot.get(root.id) ?? []).slice().sort((left, right) => (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0))
		for (const reply of replies) ordered.push({ comment: reply, indent: 1 })
	}
	return ordered
}

const buildBlocks = (comments: readonly PullRequestComment[], width: number): readonly CommentBlock[] =>
	orderForThreads(comments).map(({ comment, indent }) => {
		const usableWidth = Math.max(8, width - indent * 2)
		// Don't repeat the file path for replies — the thread root carries it.
		const groups = indent > 0 ? [] : reviewContextGroups(comment, usableWidth)
		const meta: CommentDisplayLine = { key: `${comment.id}:meta`, segments: commentMetaSegments({ item: comment, groups }) }
		const body = commentBodyRows({ keyPrefix: comment.id, body: comment.body, width: usableWidth })
		// Reserve 1 spacer line between blocks for breathing room.
		return { key: comment.id, comment, meta, body, height: 1 + body.length + 1, indent, isPlaceholder: false }
	})

const placeholderBlock: CommentBlock = {
	key: PLACEHOLDER_KEY,
	comment: null,
	meta: { key: `${PLACEHOLDER_KEY}:meta`, segments: [] },
	body: [],
	height: 1,
	indent: 0,
	isPlaceholder: true,
}

const blockOffsets = (blocks: readonly CommentBlock[]): readonly number[] => {
	const offsets: number[] = []
	let cursor = 0
	for (const block of blocks) {
		offsets.push(cursor)
		cursor += block.height
	}
	return offsets
}

const renderSegmentSpan = (segment: { readonly text: string; readonly fg: string; readonly bold?: boolean }, key: number, fgOverride?: string) => {
	const fg = fgOverride ?? segment.fg
	if (segment.bold) {
		return (
			<span key={key} fg={fg} attributes={1}>
				{segment.text}
			</span>
		)
	}
	return (
		<span key={key} fg={fg}>
			{segment.text}
		</span>
	)
}

export const CommentsPane = ({
	pullRequest,
	comments,
	status,
	selectedIndex,
	contentWidth,
	paneWidth,
	height,
	loadingIndicator,
}: {
	pullRequest: PullRequestItem
	comments: readonly PullRequestComment[]
	status: "idle" | "loading" | "ready"
	selectedIndex: number
	contentWidth: number
	paneWidth: number
	height: number
	loadingIndicator: string
}) => {
	const realBlocks = useMemo(() => buildBlocks(comments, contentWidth), [comments, contentWidth])
	const blocks = useMemo<readonly CommentBlock[]>(() => [...realBlocks, placeholderBlock], [realBlocks])
	const offsets = useMemo(() => blockOffsets(blocks), [blocks])
	const scrollboxRef = useRef<ScrollBoxRenderable | null>(null)
	const safeIndex = Math.max(0, Math.min(selectedIndex, blocks.length - 1))
	const placeholderSelected = safeIndex === blocks.length - 1

	const headerLine = (() => {
		const repo = shortRepoName(pullRequest.repository)
		const count = status === "loading" ? `${loadingIndicator} loading` : commentCountText(comments.length)
		const left = `Comments #${pullRequest.number}  ${repo}`
		const gap = Math.max(2, contentWidth - left.length - count.length)
		return { left, gap, count }
	})()

	const bodyHeight = Math.max(1, height - 4) // header + 2 dividers + footer

	useEffect(() => {
		const scrollbox = scrollboxRef.current
		if (!scrollbox) return
		const blockTop = offsets[safeIndex] ?? 0
		const blockBottom = blockTop + (blocks[safeIndex]?.height ?? 1)
		const viewportTop = scrollbox.scrollTop
		const viewportBottom = viewportTop + bodyHeight
		if (blockTop < viewportTop) scrollbox.scrollTo({ x: 0, y: blockTop })
		else if (blockBottom > viewportBottom) scrollbox.scrollTo({ x: 0, y: Math.max(0, blockBottom - bodyHeight) })
	}, [safeIndex, blocks, offsets, bodyHeight])

	const showLoading = status === "loading" && comments.length === 0
	const onRealComment = !placeholderSelected && realBlocks.length > 0
	const replyTarget = onRealComment ? realBlocks[safeIndex]?.comment : null
	const enterLabel = replyTarget?._tag === "review-comment" ? "reply" : "new"

	const footerItems: readonly HintItem[] = [
		{ key: "↑↓", label: "move", disabled: blocks.length <= 1 },
		{ key: "enter", label: enterLabel },
		{ key: "a", label: "new" },
		{ key: "o", label: "open", disabled: !onRealComment },
		{ key: "r", label: "refresh" },
		{ key: "esc", label: "close" },
	]

	return (
		<box flexDirection="column" height={height} backgroundColor={colors.background}>
			<PaddedRow>
				<TextLine>
					<span fg={colors.accent} attributes={1}>
						{headerLine.left}
					</span>
					<span fg={colors.muted}>{" ".repeat(headerLine.gap)}</span>
					<span fg={colors.muted}>{headerLine.count}</span>
				</TextLine>
			</PaddedRow>
			<Divider width={paneWidth} />
			<box height={bodyHeight} flexDirection="column">
				{showLoading ? (
					<>
						<Filler rows={Math.max(0, Math.floor((bodyHeight - 1) / 2))} prefix="loading-top" />
						<PlainLine text={centerCell(`${loadingIndicator} Loading comments`, contentWidth)} fg={colors.muted} />
						<Filler rows={Math.max(0, Math.ceil((bodyHeight - 1) / 2))} prefix="loading-bottom" />
					</>
				) : (
					<scrollbox ref={scrollboxRef} focusable={false} flexGrow={1}>
						{blocks.map((block, index) => {
							const isSelected = index === safeIndex
							const indent = " ".repeat(block.indent * 2)
							if (block.isPlaceholder) {
								return (
									<box key={block.key} flexDirection="column">
										<TextLine bg={isSelected ? colors.selectedBg : undefined}>
											<span fg={isSelected ? colors.selectedText : colors.muted}> + Add new comment...</span>
										</TextLine>
									</box>
								)
							}
							return (
								<box key={block.key} flexDirection="column">
									<TextLine bg={isSelected ? colors.selectedBg : undefined}>
										<span>{` ${indent}`}</span>
										{block.meta.segments.map((segment, segmentIndex) => renderSegmentSpan(segment, segmentIndex, isSelected ? colors.selectedText : undefined))}
									</TextLine>
									{block.body.map((line) => (
										<TextLine key={line.key}>
											<span>{` ${indent}`}</span>
											{line.segments.map((segment, segmentIndex) => renderSegmentSpan(segment, segmentIndex))}
										</TextLine>
									))}
									<PlainLine text={fitCell("", contentWidth)} fg={colors.muted} />
								</box>
							)
						})}
					</scrollbox>
				)}
			</box>
			<Divider width={paneWidth} />
			<PaddedRow>
				<HintRow items={footerItems} />
			</PaddedRow>
		</box>
	)
}
