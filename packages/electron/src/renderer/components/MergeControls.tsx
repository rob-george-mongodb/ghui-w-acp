import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { allowedMergeMethodList, availableMergeKinds, requiresMarkReady, mergeKindRowTitle, type PullRequestMergeMethod, type PullRequestMergeAction } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"

interface MergeControlsProps {
	repo: string
	number: number
}

export const MergeControls = ({ repo, number }: MergeControlsProps) => {
	const queryClient = useQueryClient()
	const [selectedMethod, setSelectedMethod] = useState<PullRequestMergeMethod>("squash")

	const { data: mergeInfo } = useQuery({
		queryKey: ["pr:mergeInfo", repo, number],
		queryFn: () => coreBridge.getPullRequestMergeInfo(repo, number),
	})

	const { data: mergeMethods } = useQuery({
		queryKey: ["pr:mergeMethods", repo],
		queryFn: () => coreBridge.getMergeMethods(repo),
	})

	const invalidateAll = () => {
		queryClient.invalidateQueries({ queryKey: ["pr:mergeInfo", repo, number] })
		queryClient.invalidateQueries({ queryKey: ["pr:details", repo, number] })
	}

	const merge = useMutation({
		mutationFn: (action: PullRequestMergeAction) => coreBridge.mergePullRequest(repo, number, action),
		onSuccess: invalidateAll,
	})

	const toggleDraft = useMutation({
		mutationFn: (isDraft: boolean) => coreBridge.toggleDraft(repo, number, isDraft),
		onSuccess: invalidateAll,
	})

	const closePR = useMutation({
		mutationFn: () => coreBridge.closePullRequest(repo, number),
		onSuccess: invalidateAll,
	})

	if (!mergeInfo) return null
	if (mergeInfo.state !== "open") return null

	const allowedMethods = mergeMethods ? allowedMergeMethodList(mergeMethods) : []
	if (allowedMethods.length === 0) return null
	const kinds = availableMergeKinds(mergeInfo)
	const effectiveMethod = allowedMethods.includes(selectedMethod) ? selectedMethod : allowedMethods[0]

	return (
		<div className="merge-controls">
			<div className="pr-detail-section-title">Merge</div>

			<div className="merge-status">
				{mergeInfo.mergeable === "conflicting" && <span className="merge-status-badge conflict">Conflicts</span>}
				{mergeInfo.mergeable === "mergeable" && <span className="merge-status-badge ready">Ready to merge</span>}
				{mergeInfo.mergeable === "unknown" && <span className="merge-status-badge unknown">Checking…</span>}
			</div>

			{mergeInfo.isDraft && (
				<button className="btn btn-secondary merge-ready-btn" disabled={toggleDraft.isPending} onClick={() => toggleDraft.mutate(false)}>
					{toggleDraft.isPending ? "Marking ready…" : "Mark as ready for review"}
				</button>
			)}

			{allowedMethods.length > 1 && (
				<select className="merge-method-select" value={effectiveMethod} onChange={(e) => setSelectedMethod(e.target.value as PullRequestMergeMethod)}>
					{allowedMethods.map((m) => (
						<option key={m} value={m}>
							{m}
						</option>
					))}
				</select>
			)}

			<div className="merge-actions">
				{effectiveMethod &&
					kinds.map((kind) => {
						const fromDraft = requiresMarkReady(mergeInfo, kind)
						const label = mergeKindRowTitle(kind, effectiveMethod, fromDraft)
						const disabled = merge.isPending || mergeInfo.mergeable === "conflicting"
						const action: PullRequestMergeAction = kind.kind === "disable-auto" ? { kind: "disable-auto" } : { kind: kind.kind, method: effectiveMethod }

						return (
							<button key={kind.kind} className={`btn ${kind.danger ? "btn-danger" : "btn-primary"}`} disabled={disabled} onClick={() => merge.mutate(action)}>
								{merge.isPending ? "Merging…" : label}
							</button>
						)
					})}
			</div>

			<button className="btn btn-ghost merge-close-btn" disabled={closePR.isPending} onClick={() => closePR.mutate()}>
				{closePR.isPending ? "Closing…" : "Close pull request"}
			</button>
		</div>
	)
}
