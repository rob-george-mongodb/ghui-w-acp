import type { CheckRollupStatus, PullRequestItem, PullRequestState, ReviewStatus } from "@ghui/core"

const stateIcon = (state: PullRequestState) => {
	switch (state) {
		case "open": return <span className="state-open">●</span>
		case "closed": return <span className="state-closed">●</span>
		case "merged": return <span className="state-merged">●</span>
	}
}

const checkIcon = (status: CheckRollupStatus) => {
	switch (status) {
		case "passing": return <span className="check-passing">✓</span>
		case "pending": return <span className="check-pending">◯</span>
		case "failing": return <span className="check-failing">✗</span>
		case "none": return null
	}
}

const reviewIcon = (status: ReviewStatus) => {
	switch (status) {
		case "approved": return <span className="check-passing" title="Approved">✔</span>
		case "changes": return <span className="check-failing" title="Changes requested">△</span>
		case "review": return <span className="check-pending" title="Review pending">◎</span>
		case "draft": return <span className="check-none" title="Draft">◇</span>
		case "none": return null
	}
}

interface PRListItemProps {
	pr: PullRequestItem
	selected: boolean
	onSelect: () => void
}

export const PRListItem = ({ pr, selected, onSelect }: PRListItemProps) => {
	return (
		<div
			className={`pr-list-item ${selected ? "selected" : ""}`}
			onClick={onSelect}
		>
			<div className="pr-list-item-header">
				{stateIcon(pr.state)}
				<span className="pr-list-item-number">#{pr.number}</span>
				<span className="pr-list-item-title">{pr.title}</span>
			</div>
			<div className="pr-list-item-meta">
				<span>{pr.author}</span>
				{reviewIcon(pr.reviewStatus)}
				{checkIcon(pr.checkStatus)}
				{pr.totalCommentsCount > 0 && <span>💬 {pr.totalCommentsCount}</span>}
				<span className="pr-list-item-diffstat">
					<span className="diffstat-add">+{pr.additions}</span>
					{" "}
					<span className="diffstat-del">-{pr.deletions}</span>
				</span>
			</div>
		</div>
	)
}
