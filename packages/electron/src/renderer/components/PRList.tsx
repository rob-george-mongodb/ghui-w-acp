import { useState, useMemo, useEffect, useCallback, useRef } from "react"
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
	const [cursor, setCursor] = useState<string | null>(null)
	const [accumulated, setAccumulated] = useState<PullRequestItem[]>([])
	const consumedCursors = useRef(new Set<string | null>())
	const queryClient = useQueryClient()

	useEffect(() => {
		setCursor(null)
		setAccumulated([])
		consumedCursors.current.clear()
	}, [activeView])

	const { data, isLoading, error } = useQuery({
		queryKey: ["pr:list", activeView, cursor],
		queryFn: () => coreBridge.listPullRequests(activeView, cursor),
	})

	useEffect(() => {
		if (data && !consumedCursors.current.has(cursor)) {
			consumedCursors.current.add(cursor)
			setAccumulated((prev) => (cursor === null ? [...data.items] : [...prev, ...data.items]))
		}
	}, [data, cursor])

	const { data: allUnresolved } = useQuery({
		queryKey: ["comment:allUnresolved"],
		queryFn: () => coreBridge.listAllUnresolvedTrackedComments(),
		staleTime: 60_000,
	})

	const unresolvedByPrKey = useMemo(() => {
		const map = new Map<string, number>()
		for (const t of allUnresolved ?? []) {
			map.set(t.prKey, (map.get(t.prKey) ?? 0) + 1)
		}
		return map
	}, [allUnresolved])

	const allItems = accumulated.length > 0 ? accumulated : (data?.items ?? [])

	const grouped = useMemo(() => {
		const groups = new Map<string, PullRequestItem[]>()
		const items = filter
			? allItems.filter(
					(pr) => pr.title.toLowerCase().includes(filter.toLowerCase()) || pr.author.toLowerCase().includes(filter.toLowerCase()) || String(pr.number).includes(filter),
				)
			: allItems

		for (const pr of items) {
			const existing = groups.get(pr.repository)
			if (existing) {
				existing.push(pr)
			} else {
				groups.set(pr.repository, [pr])
			}
		}
		return groups
	}, [allItems, filter])

	const currentMode = activeView._tag === "Queue" ? activeView.mode : null
	const currentRepo = activeView.repository

	const handleRefresh = useCallback(() => {
		setCursor(null)
		setAccumulated([])
		consumedCursors.current.clear()
		queryClient.invalidateQueries({ queryKey: ["pr:list"] })
	}, [queryClient])

	return (
		<div className="pr-list-pane">
			<div className="pr-list-tabs">
				{pullRequestQueueModes.map((mode) => (
					<button key={mode} className={`pr-list-tab ${currentMode === mode ? "active" : ""}`} onClick={() => onViewChange({ _tag: "Queue", mode, repository: currentRepo })}>
						{pullRequestQueueLabels[mode]}
					</button>
				))}
			</div>
			<div className="pr-list-toolbar">
				<SearchBar value={filter} onChange={setFilter} />
				<button onClick={handleRefresh}>↻</button>
			</div>
			<RepoSelector onViewChange={onViewChange} />
			<div className="pr-list-items">
				{isLoading && accumulated.length === 0 && <div className="loading-message">Loading…</div>}
				{error && <div className="error-message">Failed to load: {String(error)}</div>}
				{!isLoading && !error && allItems.length === 0 && <div className="loading-message">No pull requests</div>}
				{[...grouped.entries()].map(([repo, prs]) => (
					<div key={repo}>
						<div className="pr-list-group-header">{repo}</div>
						{prs.map((pr) => (
							<PRListItem
								key={`${pr.repository}#${pr.number}`}
								pr={pr}
								selected={selectedPR?.repo === pr.repository && selectedPR?.number === pr.number}
								onSelect={() => onSelectPR({ repo: pr.repository, number: pr.number })}
								unresolvedCount={unresolvedByPrKey.get(`${pr.repository}#${pr.number}`) ?? 0}
							/>
						))}
					</div>
				))}
				{data?.hasNextPage && (
					<button className="btn btn-ghost pr-load-more" onClick={() => setCursor(data.endCursor ?? null)}>
						{isLoading ? "Loading…" : "Load more"}
					</button>
				)}
			</div>
		</div>
	)
}
