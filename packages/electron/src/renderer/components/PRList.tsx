import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { PullRequestItem, PullRequestView } from "@ghui/core"
import { pullRequestQueueModes, pullRequestQueueLabels } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"
import { PRListItem } from "./PRListItem.js"
import { SearchBar } from "./SearchBar.js"
import { RepoSelector } from "./RepoSelector.js"

interface PRListProps {
	activeView: PullRequestView
	selectedPR: { repo: string; number: number } | null
	onSelectPR: (pr: { repo: string; number: number }) => void
	onViewChange: (view: PullRequestView) => void
}

export const PRList = ({ activeView, selectedPR, onSelectPR, onViewChange }: PRListProps) => {
	const [filter, setFilter] = useState("")
	const queryClient = useQueryClient()

	const { data, isLoading, error } = useQuery({
		queryKey: ["pr:list", activeView],
		queryFn: () => coreBridge.listPullRequests(activeView),
	})

	const grouped = useMemo(() => {
		const groups = new Map<string, PullRequestItem[]>()
		if (!data) return groups
		const items = filter
			? data.items.filter(
					(pr) => pr.title.toLowerCase().includes(filter.toLowerCase()) || pr.author.toLowerCase().includes(filter.toLowerCase()) || String(pr.number).includes(filter),
				)
			: data.items

		for (const pr of items) {
			const existing = groups.get(pr.repository)
			if (existing) {
				existing.push(pr)
			} else {
				groups.set(pr.repository, [pr])
			}
		}
		return groups
	}, [data, filter])

	const currentMode = activeView._tag === "Queue" ? activeView.mode : null
	const currentRepo = activeView.repository

	return (
		<div className="pr-list-pane">
			<div className="pr-list-tabs">
				{pullRequestQueueModes
					.filter((m) => m !== "inbox")
					.map((mode) => (
						<button key={mode} className={`pr-list-tab ${currentMode === mode ? "active" : ""}`} onClick={() => onViewChange({ _tag: "Queue", mode, repository: currentRepo })}>
							{pullRequestQueueLabels[mode]}
						</button>
					))}
			</div>
			<div className="pr-list-toolbar">
				<SearchBar value={filter} onChange={setFilter} />
				<button onClick={() => queryClient.invalidateQueries({ queryKey: ["pr:list"] })}>↻</button>
			</div>
			<RepoSelector onViewChange={onViewChange} />
			<div className="pr-list-items">
				{isLoading && <div className="loading-message">Loading…</div>}
				{error && <div className="error-message">Failed to load: {String(error)}</div>}
				{!isLoading && !error && data?.items.length === 0 && <div className="loading-message">No pull requests</div>}
				{[...grouped.entries()].map(([repo, prs]) => (
					<div key={repo}>
						<div className="pr-list-group-header">{repo}</div>
						{prs.map((pr) => (
							<PRListItem
								key={`${pr.repository}#${pr.number}`}
								pr={pr}
								selected={selectedPR?.repo === pr.repository && selectedPR?.number === pr.number}
								onSelect={() => onSelectPR({ repo: pr.repository, number: pr.number })}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	)
}
