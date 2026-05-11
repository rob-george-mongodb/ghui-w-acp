import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { daysOpen, formatRelativeDate, type LoadStatus, type PullRequestItem } from "@ghui/core"
import { colors, rowHoverBackground } from "./colors.js"
import { fitCell, MatchedCell, PlainLine, SectionTitle, TextLine } from "./primitives.js"
import { pullRequestRowDisplay, repoColor, reviewIcon, shortRepoName } from "./pullRequests.js"

export type PullRequestGroups = Array<[string, PullRequestItem[]]>

export type PullRequestListRow =
	| { readonly _tag: "title" }
	| { readonly _tag: "filter" }
	| { readonly _tag: "message"; readonly text: string; readonly color: string }
	| { readonly _tag: "group"; readonly label: string; readonly pullRequests: readonly PullRequestItem[]; readonly kind: "repository" | "inbox-section" }
	| { readonly _tag: "pull-request"; readonly pullRequest: PullRequestItem; readonly numberWidth: number; readonly ageWidth: number; readonly kind: "repository" | "inbox" }
	| { readonly _tag: "load-more"; readonly text: string }

const GROUP_ICON = "◆"
const REVIEW_WIDTH = 1
const CHECK_WIDTH = 2

const getRowLayout = (contentWidth: number, numberWidth: number, ageWidth: number) => {
	const reviewWidth = REVIEW_WIDTH
	const checkWidth = CHECK_WIDTH
	const fixedWidth = reviewWidth + 1 + numberWidth + 1 + checkWidth + ageWidth
	const titleWidth = Math.max(8, contentWidth - fixedWidth)
	return { reviewWidth, checkWidth, ageWidth, numberWidth, titleWidth }
}

const groupNumberWidth = (pullRequests: readonly PullRequestItem[]) => {
	if (pullRequests.length === 0) return 4
	const maxLen = Math.max(...pullRequests.map((pr) => String(pr.number).length))
	return maxLen + 1
}

const groupAgeWidth = (pullRequests: readonly PullRequestItem[], kind: "repository" | "inbox") => {
	if (kind === "inbox") return 0
	if (pullRequests.length === 0) return 4
	const maxLen = Math.max(...pullRequests.map((pr) => `${daysOpen(pr.createdAt)}d`.length))
	return Math.max(4, maxLen + 1)
}

const GroupTitle = ({ label, color, filterText }: { label: string; color: string; filterText: string }) => (
	<TextLine>
		<span fg={color}>{GROUP_ICON} </span>
		<span fg={color} attributes={TextAttributes.BOLD}>
			<MatchedCell text={label} width={label.length} query={filterText} />
		</span>
	</TextLine>
)

export const buildPullRequestListRows = ({
	groups,
	status,
	error,
	filterText,
	showFilterBar,
	loadedCount,
	hasMore,
	isLoadingMore,
	loadingIndicator = "-",
	groupKind = "repository",
}: {
	readonly groups: PullRequestGroups
	readonly status: LoadStatus
	readonly error: string | null
	readonly filterText: string
	readonly showFilterBar: boolean
	readonly loadedCount: number
	readonly hasMore: boolean
	readonly isLoadingMore: boolean
	readonly loadingIndicator?: string
	readonly groupKind?: "repository" | "inbox-section"
}): readonly PullRequestListRow[] => {
	const itemCount = groups.reduce((count, [, pullRequests]) => count + pullRequests.length, 0)
	const rows: PullRequestListRow[] = [{ _tag: "title" }]
	if (showFilterBar) rows.push({ _tag: "filter" })
	if (status === "loading" && itemCount === 0) rows.push({ _tag: "message", text: "- Loading pull requests...", color: colors.muted })
	if (status === "error") rows.push({ _tag: "message", text: `- ${error ?? "Could not load pull requests."}`, color: colors.error })
	if (status === "ready" && itemCount === 0)
		rows.push({ _tag: "message", text: filterText.length > 0 ? "- No matching pull requests." : "- No open pull requests.", color: colors.muted })
	for (const [repository, pullRequests] of groups) {
		rows.push({ _tag: "group", label: repository, pullRequests, kind: groupKind })
		const rowKind = groupKind === "inbox-section" ? ("inbox" as const) : ("repository" as const)
		const numberWidth = groupNumberWidth(pullRequests)
		const ageWidth = groupAgeWidth(pullRequests, rowKind)
		for (const pullRequest of pullRequests) rows.push({ _tag: "pull-request", pullRequest, numberWidth, ageWidth, kind: rowKind })
	}
	if (status === "ready" && itemCount > 0 && (hasMore || isLoadingMore)) {
		rows.push({ _tag: "load-more", text: isLoadingMore ? `${loadingIndicator} Loading more pull requests... (${loadedCount} loaded)` : `- ${loadedCount} loaded, more available` })
	}
	return rows
}

export const pullRequestListRowIndex = (rows: readonly PullRequestListRow[], url: string | null) => {
	if (!url) return null
	const index = rows.findIndex((row) => row._tag === "pull-request" && row.pullRequest.url === url)
	return index >= 0 ? index : null
}

const PullRequestRow = ({
	pullRequest,
	selected,
	hovered,
	contentWidth,
	numWidth,
	ageColWidth,
	filterText,
	kind,
	onSelect,
	onHoverChange,
}: {
	pullRequest: PullRequestItem
	selected: boolean
	hovered: boolean
	contentWidth: number
	numWidth: number
	ageColWidth: number
	filterText: string
	kind: "repository" | "inbox"
	onSelect: () => void
	onHoverChange: (hovered: boolean) => void
}) => {
	const display = pullRequestRowDisplay(pullRequest, selected)
	const rowBg = selected ? colors.selectedBg : hovered ? rowHoverBackground() : undefined

	if (kind === "inbox") {
		const titleWidth = Math.max(8, contentWidth - REVIEW_WIDTH - 1 - numWidth - 1 - 2)
		const indent = " ".repeat(REVIEW_WIDTH + 1 + numWidth + 1)
		const meta = `${shortRepoName(pullRequest.repository)}#${pullRequest.number} • ${pullRequest.author} • ${formatRelativeDate(pullRequest.updatedAt)}${pullRequest.totalCommentsCount > 0 ? ` • ${pullRequest.totalCommentsCount} comments` : ""}`

		return (
			<box flexDirection="column" width={contentWidth}>
				<TextLine width={contentWidth} fg={display.rowFg} bg={rowBg} onMouseDown={onSelect} onMouseOver={() => onHoverChange(true)} onMouseOut={() => onHoverChange(false)}>
					<span fg={display.indicatorFg}>{fitCell(reviewIcon(pullRequest), REVIEW_WIDTH)}</span>
					<span> </span>
					<span fg={display.numberFg}>
						<MatchedCell text={`#${pullRequest.number}`} width={numWidth} query={filterText} align="right" />
					</span>
					<span> </span>
					<span>
						<MatchedCell text={pullRequest.title} width={titleWidth} query={filterText} />
					</span>
					<span fg={display.checkFg}>{fitCell(display.checkText, CHECK_WIDTH, "right")}</span>
				</TextLine>
				<TextLine width={contentWidth} bg={rowBg} onMouseDown={onSelect} onMouseOver={() => onHoverChange(true)} onMouseOut={() => onHoverChange(false)}>
					<span fg={colors.muted}>
						{indent}
						{fitCell(meta, contentWidth - indent.length)}
					</span>
				</TextLine>
			</box>
		)
	}

	const ageText = `${daysOpen(pullRequest.createdAt)}d`
	const { reviewWidth, checkWidth, ageWidth, numberWidth, titleWidth } = getRowLayout(contentWidth, numWidth, ageColWidth)
	const rowWidth = reviewWidth + 1 + numberWidth + 1 + titleWidth + checkWidth + ageWidth
	const fillerWidth = Math.max(0, contentWidth - rowWidth)

	return (
		<TextLine width={contentWidth} fg={display.rowFg} bg={rowBg} onMouseDown={onSelect} onMouseOver={() => onHoverChange(true)} onMouseOut={() => onHoverChange(false)}>
			<span fg={display.indicatorFg}>{fitCell(reviewIcon(pullRequest), reviewWidth)}</span>
			<span> </span>
			<span fg={display.numberFg}>
				<MatchedCell text={`#${pullRequest.number}`} width={numberWidth} query={filterText} align="right" />
			</span>
			<span> </span>
			<span>
				<MatchedCell text={pullRequest.title} width={titleWidth} query={filterText} />
			</span>
			<span fg={colors.muted}>{fitCell(ageText, ageWidth, "right")}</span>
			<span fg={display.checkFg}>{fitCell(display.checkText, checkWidth, "right")}</span>
			{fillerWidth > 0 ? <span>{" ".repeat(fillerWidth)}</span> : null}
		</TextLine>
	)
}

export const PullRequestList = ({
	groups,
	selectedUrl,
	status,
	error,
	contentWidth,
	filterText,
	showFilterBar,
	isFilterEditing,
	loadedCount,
	hasMore,
	isLoadingMore,
	loadingIndicator,
	groupKind = "repository",
	onSelectPullRequest,
}: {
	groups: PullRequestGroups
	selectedUrl: string | null
	status: LoadStatus
	error: string | null
	contentWidth: number
	filterText: string
	showFilterBar: boolean
	isFilterEditing: boolean
	loadedCount: number
	hasMore: boolean
	isLoadingMore: boolean
	loadingIndicator: string
	groupKind?: "repository" | "inbox-section"
	onSelectPullRequest: (url: string) => void
}) => {
	const rows = buildPullRequestListRows({ groups, status, error, filterText, showFilterBar, loadedCount, hasMore, isLoadingMore, loadingIndicator, groupKind })
	const [hoveredUrl, setHoveredUrl] = useState<string | null>(null)

	return (
		<box width={contentWidth} flexDirection="column">
			{rows.map((row, index) => {
				if (row._tag === "title") return <SectionTitle key="title" title="PULL REQUESTS" />
				if (row._tag === "filter") {
					return (
						<TextLine key="filter">
							<span fg={colors.count}>/</span>
							<span fg={colors.muted}> </span>
							<span fg={isFilterEditing ? colors.text : colors.count}>{filterText.length > 0 ? filterText : "type to filter..."}</span>
						</TextLine>
					)
				}
				if (row._tag === "message") return <PlainLine key={`message-${index}`} text={row.text} fg={row.color} />
				if (row._tag === "load-more") return <PlainLine key="load-more" text={row.text} fg={colors.muted} />
				if (row._tag === "group")
					return <GroupTitle key={`group-${row.label}`} label={row.label} color={row.kind === "inbox-section" ? colors.accent : repoColor(row.label)} filterText={filterText} />

				const pullRequestUrl = row.pullRequest.url
				return (
					<PullRequestRow
						key={pullRequestUrl}
						pullRequest={row.pullRequest}
						selected={pullRequestUrl === selectedUrl}
						hovered={pullRequestUrl === hoveredUrl}
						contentWidth={contentWidth}
						numWidth={row.numberWidth}
						ageColWidth={row.ageWidth}
						filterText={filterText}
						kind={row.kind}
						onSelect={() => onSelectPullRequest(pullRequestUrl)}
						onHoverChange={(hovered) =>
							setHoveredUrl((current) => (hovered ? (current === pullRequestUrl ? current : pullRequestUrl) : current === pullRequestUrl ? null : current))
						}
					/>
				)
			})}
		</box>
	)
}
