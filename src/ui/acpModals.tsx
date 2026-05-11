import { TextAttributes } from "@opentui/core"
import type { ReviewFinding, ReviewSession, SessionMessage } from "@ghui/core"
import { clampCursor, commentEditorLines, cursorLineIndexForLines } from "./commentEditor.js"
import { colors } from "./colors.js"
import {
	centerCell,
	Filler,
	fitCell,
	HintRow,
	PlainLine,
	standardModalDims,
	StandardModal,
	TextLine,
} from "./primitives.js"
import type {
	FindingEditModalState,
	HumanCommentModalState,
	InitiateReviewModalState,
	PostFindingsModalState,
} from "./modals.js"
import { shortRepoName } from "./pullRequests.js"

export const InitiateReviewModal = ({
	state,
	agentName,
	worktreePath,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
	loadingIndicator,
}: {
	state: InitiateReviewModalState
	agentName: string
	worktreePath: string
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
	loadingIndicator: string
}) => {
	const { contentWidth, bodyHeight } = standardModalDims(modalWidth, modalHeight)
	const rightText = state.loading ? `${loadingIndicator} starting` : "confirm"
	const repo = state.prRepository ? shortRepoName(state.prRepository) : ""
	const subtitle = `${repo} #${state.prNumber}`
	const topRows = Math.max(0, Math.floor((bodyHeight - 3) / 2))
	const bottomRows = Math.max(0, bodyHeight - topRows - 3 - (state.error ? 1 : 0))

	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title="Initiate AI Review"
			headerRight={{ text: rightText, pending: state.loading }}
			subtitle={<PlainLine text={fitCell(subtitle, contentWidth)} fg={colors.muted} />}
			bodyPadding={1}
			footer={
				<HintRow
					items={[
						{ key: "enter", label: "start" },
						{ key: "esc", label: "cancel" },
					]}
				/>
			}
		>
			{state.error ? <PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} /> : null}
			<Filler rows={topRows} prefix="top" />
			<PlainLine text={fitCell(state.prTitle, contentWidth)} fg={colors.text} bold />
			<PlainLine text={fitCell(`Agent: ${agentName}`, contentWidth)} fg={colors.muted} />
			<PlainLine text={fitCell(`Worktree: ${worktreePath}`, contentWidth)} fg={colors.muted} />
			<Filler rows={bottomRows} prefix="bottom" />
		</StandardModal>
	)
}

const renderTextEditor = ({
	body,
	cursor: rawCursor,
	contentWidth,
	editorHeight,
	placeholder,
}: {
	body: string
	cursor: number
	contentWidth: number
	editorHeight: number
	placeholder: string
}) => {
	const lineRanges = commentEditorLines(body)
	const cursor = clampCursor(body, rawCursor)
	const cursorLineIndex = cursorLineIndexForLines(lineRanges, cursor)
	const visibleStart = Math.min(Math.max(0, lineRanges.length - editorHeight), Math.max(0, cursorLineIndex - editorHeight + 1))
	const visibleLines = lineRanges.slice(visibleStart, visibleStart + editorHeight)

	return visibleLines.map((line, index) => {
		const lineIndex = visibleStart + index
		const isCursorLine = lineIndex === cursorLineIndex
		const cursorColumn = Math.max(0, Math.min(cursor - line.start, line.text.length))
		const viewStart = isCursorLine ? Math.max(0, cursorColumn - contentWidth + 1) : 0
		const visibleText = line.text.slice(viewStart, viewStart + contentWidth)

		if (!isCursorLine) {
			return <PlainLine key={lineIndex} text={fitCell(visibleText, contentWidth)} fg={body.length > 0 ? colors.text : colors.muted} />
		}

		const cursorInView = cursorColumn - viewStart
		const before = visibleText.slice(0, cursorInView)
		const placeholderText = body.length === 0 ? placeholder : ""
		const cursorChar = placeholderText ? (placeholderText[0] ?? " ") : (visibleText[cursorInView] ?? " ")
		const after = placeholderText ? placeholderText.slice(1) : visibleText.slice(cursorInView + 1)

		return (
			<TextLine key={lineIndex}>
				{before ? <span fg={colors.text}>{before}</span> : null}
				<span bg={colors.accent} fg={colors.background}>
					{cursorChar}
				</span>
				{after ? <span fg={placeholderText ? colors.muted : colors.text}>{after}</span> : null}
			</TextLine>
		)
	})
}

const editorModalHints: readonly { key: string; label: string }[] = [
	{ key: "ctrl-s", label: "save" },
	{ key: "shift-enter", label: "newline" },
	{ key: "esc", label: "cancel" },
]

export const FindingEditModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	state: FindingEditModalState
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
}) => {
	const { contentWidth, bodyHeight } = standardModalDims(modalWidth, modalHeight)
	const editorHeight = Math.max(1, bodyHeight - (state.error ? 1 : 0))

	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title="Edit Finding"
			headerRight={{ text: "ctrl-s save" }}
			subtitle={<PlainLine text={fitCell("Edit the finding body before posting.", contentWidth)} fg={colors.muted} />}
			bodyPadding={1}
			footer={<HintRow items={editorModalHints} />}
		>
			{state.error ? <PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} /> : null}
			{renderTextEditor({ body: state.body, cursor: state.cursor, contentWidth, editorHeight, placeholder: "Finding body..." })}
		</StandardModal>
	)
}

export const HumanCommentModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	state: HumanCommentModalState
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
}) => {
	const { contentWidth, bodyHeight } = standardModalDims(modalWidth, modalHeight)
	const editorHeight = Math.max(1, bodyHeight - (state.error ? 1 : 0))

	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title="Write Comment"
			headerRight={{ text: "ctrl-s save" }}
			subtitle={<PlainLine text={fitCell("Draft a comment to post later via Post Findings.", contentWidth)} fg={colors.muted} />}
			bodyPadding={1}
			footer={<HintRow items={editorModalHints} />}
		>
			{state.error ? <PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} /> : null}
			{renderTextEditor({ body: state.body, cursor: state.cursor, contentWidth, editorHeight, placeholder: "Comment body..." })}
		</StandardModal>
	)
}

const postableStatuses = new Set(["accepted", "modified", "pending_review"])

const severityColor = (severity: string | null): string => {
	if (severity === "critical" || severity === "blocking") return colors.status.failing
	if (severity === "moderate") return colors.status.pending
	return colors.muted
}

export const PostFindingsModal = ({
	state,
	findings,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
	loadingIndicator,
}: {
	state: PostFindingsModalState
	findings: readonly ReviewFinding[]
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
	loadingIndicator: string
}) => {
	const { contentWidth, bodyHeight } = standardModalDims(modalWidth, modalHeight)
	const postable = findings.filter((f) => postableStatuses.has(f.status))
	const selectedIndex = postable.length === 0 ? 0 : Math.max(0, Math.min(state.selectedIndex, postable.length - 1))
	const scrollStart = Math.min(Math.max(0, postable.length - bodyHeight), Math.max(0, selectedIndex - bodyHeight + 1))
	const visible = postable.slice(scrollStart, scrollStart + bodyHeight)
	const rightText = state.running ? `${loadingIndicator} posting` : `${postable.length} findings`
	const messageTopRows = Math.max(0, Math.floor((bodyHeight - 1) / 2))
	const messageBottomRows = Math.max(0, bodyHeight - messageTopRows - 1)

	return (
		<StandardModal
			left={offsetLeft}
			top={offsetTop}
			width={modalWidth}
			height={modalHeight}
			title="Post Findings"
			headerRight={{ text: rightText, pending: state.running }}
			subtitle={<PlainLine text={fitCell("Review findings to post as PR comments.", contentWidth)} fg={colors.muted} />}
			bodyPadding={1}
			footer={
				<HintRow
					items={[
						{ key: "enter", label: "post all" },
						{ key: "↑↓", label: "scroll" },
						{ key: "esc", label: "cancel" },
					]}
				/>
			}
		>
			{state.staleness ? <PlainLine text={fitCell("⚠ PR has new commits — line numbers may be stale", contentWidth)} fg={colors.status.pending} /> : null}
			{state.error ? (
				<PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} />
			) : visible.length === 0 ? (
				<>
					<Filler rows={messageTopRows} prefix="top" />
					<PlainLine text={centerCell("No postable findings", contentWidth)} fg={colors.muted} />
					<Filler rows={messageBottomRows} prefix="bottom" />
				</>
			) : (
				visible.map((finding, index) => {
					const actualIndex = scrollStart + index
					const isSelected = actualIndex === selectedIndex
					const label = finding.title || finding.body.slice(0, 40)
					const sevBadge = finding.severity ? `[${finding.severity}] ` : ""
					const fileLoc = finding.filePath ? ` ${finding.filePath}:${finding.lineStart ?? ""}` : ""
					const rowText = `${sevBadge}${label}${fileLoc}`
					return (
						<TextLine key={finding.id} bg={isSelected ? colors.selectedBg : undefined} fg={isSelected ? colors.selectedText : colors.text}>
							<span fg={severityColor(finding.severity)}>{fitCell(rowText, contentWidth)}</span>
						</TextLine>
					)
				})
			)}
		</StandardModal>
	)
}

const findingStatusColor = (status: string): string => {
	switch (status) {
		case "pending_review":
			return colors.muted
		case "accepted":
			return colors.status.passing
		case "rejected":
			return colors.status.failing
		case "modified":
			return colors.status.review
		case "posted":
			return colors.count
		default:
			return colors.muted
	}
}

export const FindingsPanel = ({
	findings,
	selectedIndex,
	contentWidth,
	contentHeight,
	loadingIndicator,
}: {
	findings: readonly ReviewFinding[]
	selectedIndex: number
	contentWidth: number
	contentHeight: number
	loadingIndicator: string
}) => {
	const headerHeight = 2
	const footerHeight = 1
	const listHeight = Math.max(1, contentHeight - headerHeight - footerHeight)
	const clampedIndex = findings.length === 0 ? 0 : Math.max(0, Math.min(selectedIndex, findings.length - 1))
	const scrollStart = Math.min(Math.max(0, findings.length - listHeight), Math.max(0, clampedIndex - listHeight + 1))
	const visible = findings.slice(scrollStart, scrollStart + listHeight)
	const countLabel = findings.length === 1 ? "1 finding" : `${findings.length} findings`
	const emptyTopRows = Math.max(0, Math.floor((listHeight - 1) / 2))
	const emptyBottomRows = Math.max(0, listHeight - emptyTopRows - 1)

	return (
		<box width={contentWidth} height={contentHeight} flexDirection="column">
			<TextLine>
				<span fg={colors.accent} attributes={TextAttributes.BOLD}>
					Findings
				</span>
				<span fg={colors.muted}> {countLabel}</span>
			</TextLine>
			<PlainLine text={"─".repeat(contentWidth)} fg={colors.separator} />
			<box height={listHeight} flexDirection="column">
				{findings.length === 0 ? (
					<>
						<Filler rows={emptyTopRows} prefix="top" />
						<PlainLine text={centerCell("No findings yet", contentWidth)} fg={colors.muted} />
						<Filler rows={emptyBottomRows} prefix="bottom" />
					</>
				) : (
					visible.map((finding, index) => {
						const actualIndex = scrollStart + index
						const isSelected = actualIndex === clampedIndex
						const sevBadge = finding.severity ? `[${finding.severity}] ` : ""
						const label = finding.title || finding.body.slice(0, 40)
						const fileLoc = finding.filePath ? ` ${finding.filePath}:${finding.lineStart ?? ""}` : ""
						const statusBadge = ` [${finding.status}]`
						const mainWidth = Math.max(1, contentWidth - statusBadge.length)
						const rowText = `${sevBadge}${label}${fileLoc}`
						return (
							<TextLine key={finding.id} bg={isSelected ? colors.selectedBg : undefined} fg={isSelected ? colors.selectedText : colors.text}>
								<span>{fitCell(rowText, mainWidth)}</span>
								<span fg={findingStatusColor(finding.status)}>{statusBadge}</span>
							</TextLine>
						)
					})
				)}
			</box>
			<HintRow
				items={[
					{ key: "a", label: "accept" },
					{ key: "x", label: "reject" },
					{ key: "e", label: "edit" },
					{ key: "p", label: "post" },
					{ key: "w", label: "write" },
					{ key: "esc", label: "close" },
				]}
			/>
		</box>
	)
}

const wrapText = (text: string, width: number): string[] => {
	if (width <= 0) return [text]
	const lines: string[] = []
	for (const rawLine of text.split("\n")) {
		if (rawLine.length === 0) {
			lines.push("")
			continue
		}
		let remaining = rawLine
		while (remaining.length > width) {
			lines.push(remaining.slice(0, width))
			remaining = remaining.slice(width)
		}
		lines.push(remaining)
	}
	return lines
}

export const AskAIPanel = ({
	messages,
	inputText,
	cursor,
	loading,
	error,
	contentWidth,
	contentHeight,
	loadingIndicator,
}: {
	messages: readonly SessionMessage[]
	inputText: string
	cursor: number
	loading: boolean
	error: string | null
	contentWidth: number
	contentHeight: number
	loadingIndicator: string
}) => {
	const headerHeight = 2
	const footerHeight = 1
	const inputHeight = 3
	const dividerHeight = 1
	const errorHeight = error ? 1 : 0
	const messageAreaHeight = Math.max(1, contentHeight - headerHeight - footerHeight - inputHeight - dividerHeight - errorHeight)
	const wrapWidth = Math.max(1, contentWidth - 4)

	const messageRows: { key: string; role: string; text: string }[] = []
	for (const msg of messages) {
		const wrapped = wrapText(msg.content, wrapWidth)
		for (let i = 0; i < wrapped.length; i++) {
			messageRows.push({ key: `${msg.id}-${i}`, role: msg.role, text: wrapped[i]! })
		}
	}

	const visibleStart = Math.max(0, messageRows.length - messageAreaHeight)
	const visibleMessages = messageRows.slice(visibleStart, visibleStart + messageAreaHeight)
	const fillerRows = Math.max(0, messageAreaHeight - visibleMessages.length)

	const editorLines = renderTextEditor({
		body: inputText,
		cursor,
		contentWidth: Math.max(1, contentWidth - 2),
		editorHeight: inputHeight,
		placeholder: loading ? "Thinking…" : "Ask a question...",
	})

	return (
		<box width={contentWidth} height={contentHeight} flexDirection="column">
			<TextLine>
				<span fg={colors.accent} attributes={TextAttributes.BOLD}>
					Ask AI
				</span>
			</TextLine>
			<PlainLine text={"─".repeat(contentWidth)} fg={colors.separator} />
			<box height={messageAreaHeight} flexDirection="column">
				<Filler rows={fillerRows} prefix="msg-fill" />
				{visibleMessages.map((row, idx) => {
					const isUser = row.role === "user"
					return (
						<TextLine key={row.key}>
							<span fg={isUser ? colors.accent : colors.muted}>{fitCell(isUser ? "you" : "ai", 4)}</span>
							<span fg={colors.text}>{fitCell(row.text, Math.max(1, contentWidth - 4))}</span>
						</TextLine>
					)
				})}
			</box>
			<PlainLine text={"─".repeat(contentWidth)} fg={colors.separator} />
			{error ? <PlainLine text={fitCell(error, contentWidth)} fg={colors.error} /> : null}
			<box height={inputHeight} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{editorLines}
			</box>
			<HintRow
				items={[
					{ key: "ctrl-s", label: "send" },
					{ key: "shift-enter", label: "newline" },
					{ key: "esc", label: "close" },
				]}
			/>
		</box>
	)
}

export const SessionViewerPanel = ({
	sessions,
	selectedSessionIndex,
	expandedSessionId,
	messages,
	contentWidth,
	contentHeight,
}: {
	sessions: readonly ReviewSession[]
	selectedSessionIndex: number
	expandedSessionId: string | null
	messages: readonly SessionMessage[]
	contentWidth: number
	contentHeight: number
}) => {
	const headerHeight = 2
	const footerHeight = 1
	const listHeight = Math.max(1, contentHeight - headerHeight - footerHeight)
	const countLabel = sessions.length === 1 ? "1 session" : `${sessions.length} sessions`
	const clampedIndex = sessions.length === 0 ? 0 : Math.max(0, Math.min(selectedSessionIndex, sessions.length - 1))
	const emptyTopRows = Math.max(0, Math.floor((listHeight - 1) / 2))
	const emptyBottomRows = Math.max(0, listHeight - emptyTopRows - 1)

	const expandedSession = expandedSessionId ? sessions.find((s) => s.sessionId === expandedSessionId) : null

	const renderSessionList = () => {
		if (sessions.length === 0) {
			return (
				<>
					<Filler rows={emptyTopRows} prefix="top" />
					<PlainLine text={centerCell("No sessions yet", contentWidth)} fg={colors.muted} />
					<Filler rows={emptyBottomRows} prefix="bottom" />
				</>
			)
		}
		const scrollStart = Math.min(Math.max(0, sessions.length - listHeight), Math.max(0, clampedIndex - listHeight + 1))
		const visible = sessions.slice(scrollStart, scrollStart + listHeight)
		return visible.map((session, index) => {
			const actualIndex = scrollStart + index
			const isSelected = actualIndex === clampedIndex
			const time = new Date(session.startedAt).toLocaleTimeString()
			const status = session.endedAt ? "ended" : "active"
			const row = `${session.sessionType} ${session.agentName} ${time} ${status}`
			return (
				<TextLine key={session.sessionId} bg={isSelected ? colors.selectedBg : undefined} fg={isSelected ? colors.selectedText : colors.text}>
					<span>{fitCell(row, contentWidth)}</span>
				</TextLine>
			)
		})
	}

	const renderExpanded = () => {
		if (!expandedSession) return null
		const wrapWidth = Math.max(1, contentWidth - 4)
		const metaRow = `${expandedSession.sessionType} ${expandedSession.agentName} — ${new Date(expandedSession.startedAt).toLocaleTimeString()}`
		const msgRows: { key: string; role: string; text: string }[] = []
		for (const msg of messages) {
			const wrapped = wrapText(msg.content, wrapWidth)
			for (let i = 0; i < wrapped.length; i++) {
				msgRows.push({ key: `${msg.id}-${i}`, role: msg.role, text: wrapped[i]! })
			}
		}
		const msgAreaHeight = Math.max(1, listHeight - 1)
		const visibleStart = Math.max(0, msgRows.length - msgAreaHeight)
		const visibleMsgs = msgRows.slice(visibleStart, visibleStart + msgAreaHeight)
		const fillerRows = Math.max(0, msgAreaHeight - visibleMsgs.length)

		return (
			<>
				<PlainLine text={fitCell(metaRow, contentWidth)} fg={colors.muted} />
				<Filler rows={fillerRows} prefix="msg-fill" />
				{visibleMsgs.map((row) => {
					const isUser = row.role === "user"
					return (
						<TextLine key={row.key}>
							<span fg={isUser ? colors.accent : colors.muted}>{fitCell(isUser ? "you" : "ai", 4)}</span>
							<span fg={colors.text}>{fitCell(row.text, Math.max(1, contentWidth - 4))}</span>
						</TextLine>
					)
				})}
			</>
		)
	}

	return (
		<box width={contentWidth} height={contentHeight} flexDirection="column">
			<TextLine>
				<span fg={colors.accent} attributes={TextAttributes.BOLD}>
					Sessions
				</span>
				<span fg={colors.muted}> {countLabel}</span>
			</TextLine>
			<PlainLine text={"─".repeat(contentWidth)} fg={colors.separator} />
			<box height={listHeight} flexDirection="column">
				{expandedSession ? renderExpanded() : renderSessionList()}
			</box>
			<HintRow
				items={[
					{ key: "enter", label: "expand" },
					{ key: "↑↓", label: "move" },
					{ key: "esc", label: "close" },
				]}
			/>
		</box>
	)
}
