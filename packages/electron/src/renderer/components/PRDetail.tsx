import { useQuery } from "@tanstack/react-query"
import { coreBridge } from "../hooks/useCoreBridge.js"
import { LabelBadge } from "./LabelBadge.js"
import { StatusChecks } from "./StatusChecks.js"
import { MergeControls } from "./MergeControls.js"

interface PRDetailProps {
	repo: string
	number: number
}

export const PRDetail = ({ repo, number }: PRDetailProps) => {
	const { data: pr, isLoading, error } = useQuery({
		queryKey: ["pr:details", repo, number],
		queryFn: () => coreBridge.getPullRequestDetails(repo, number),
	})

	if (isLoading) return <div className="pr-detail-loading">Loading…</div>
	if (error) return <div className="pr-detail-loading error-message">Failed to load PR</div>
	if (!pr) return null

	return (
		<div>
			<div className="pr-detail-header">
				<div className="pr-detail-title">
					<span>{pr.title}</span>
					<span className="pr-detail-title-number">#{pr.number}</span>
				</div>
				<div className="pr-detail-meta">
					<span className={`pr-detail-state-badge ${pr.state}`}>{pr.state}</span>
					<span>{pr.author}</span>
					<span>{pr.headRefName}</span>
				</div>
			</div>

			<div className="pr-detail-actions">
				<button onClick={() => coreBridge.openInBrowser(pr.url)}>Open in browser</button>
				<button onClick={() => coreBridge.copyToClipboard(pr.url)}>Copy URL</button>
			</div>

			{pr.labels.length > 0 && (
				<div className="pr-detail-section">
					<div className="pr-detail-section-title">Labels</div>
					<div className="labels-list">
						{pr.labels.map((label) => (
							<LabelBadge key={label.name} label={label} />
						))}
					</div>
				</div>
			)}

			{(pr.assignees.length > 0 || pr.reviewRequests.length > 0) && (
				<div className="pr-detail-section">
					{pr.assignees.length > 0 && (
						<>
							<div className="pr-detail-section-title">Assignees</div>
							<div className="people-list">
								{pr.assignees.map((a) => (
									<span key={a.login} className="person-chip">{a.login}</span>
								))}
							</div>
						</>
					)}
					{pr.reviewRequests.length > 0 && (
						<>
							<div className="pr-detail-section-title" style={{ marginTop: pr.assignees.length > 0 ? 12 : 0 }}>Reviewers</div>
							<div className="people-list">
								{pr.reviewRequests.map((r) => (
									<span key={r.name} className="person-chip">{r.name}</span>
								))}
							</div>
						</>
					)}
				</div>
			)}

			{pr.checks.length > 0 && (
				<div className="pr-detail-section">
					<div className="pr-detail-section-title">Status Checks</div>
					<StatusChecks checks={pr.checks} />
				</div>
			)}

			{pr.body && <div className="pr-detail-body">{pr.body}</div>}

			<MergeControls repo={repo} number={number} />
		</div>
	)
}
