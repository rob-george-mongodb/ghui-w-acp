import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { PullRequestLabel } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"
import { LabelBadge } from "./LabelBadge.js"

interface LabelManagerProps {
	repo: string
	number: number
	currentLabels: readonly PullRequestLabel[]
}

export const LabelManager = ({ repo, number, currentLabels }: LabelManagerProps) => {
	const [expanded, setExpanded] = useState(false)
	const [filter, setFilter] = useState("")
	const queryClient = useQueryClient()

	const { data: repoLabels } = useQuery({
		queryKey: ["pr:labels:list", repo],
		queryFn: () => coreBridge.listLabels(repo),
		enabled: expanded,
	})

	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pr:details", repo, number] })

	const addLabel = useMutation({
		mutationFn: (label: string) => coreBridge.addLabel(repo, number, label),
		onSuccess: invalidate,
	})

	const removeLabel = useMutation({
		mutationFn: (label: string) => coreBridge.removeLabel(repo, number, label),
		onSuccess: invalidate,
	})

	const currentLabelNames = useMemo(() => new Set(currentLabels.map((l) => l.name)), [currentLabels])

	const filteredLabels = useMemo(() => {
		if (!repoLabels) return []
		const q = filter.toLowerCase()
		return q ? repoLabels.filter((l) => l.name.toLowerCase().includes(q)) : repoLabels
	}, [repoLabels, filter])

	if (!expanded) {
		return (
			<button className="btn-sm btn-ghost" onClick={() => setExpanded(true)}>
				Manage labels
			</button>
		)
	}

	return (
		<div className="label-manager">
			<input className="label-manager-search" type="text" placeholder="Filter labels…" value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
			<div className="label-manager-list">
				{filteredLabels.map((label) => {
					const isActive = currentLabelNames.has(label.name)
					const pending = addLabel.isPending || removeLabel.isPending
					return (
						<label key={label.name} className="label-manager-item">
							<input type="checkbox" checked={isActive} disabled={pending} onChange={() => (isActive ? removeLabel.mutate(label.name) : addLabel.mutate(label.name))} />
							<LabelBadge label={label} />
						</label>
					)
				})}
			</div>
			<button className="btn-sm btn-ghost" onClick={() => setExpanded(false)}>
				Done
			</button>
		</div>
	)
}
