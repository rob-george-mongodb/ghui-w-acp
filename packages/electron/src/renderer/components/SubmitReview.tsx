import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PullRequestReviewEvent } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"

interface SubmitReviewProps {
	repo: string
	number: number
}

const EVENT_LABELS: Record<PullRequestReviewEvent, string> = {
	APPROVE: "Approve",
	COMMENT: "Comment",
	REQUEST_CHANGES: "Request changes",
}

export const SubmitReview = ({ repo, number }: SubmitReviewProps) => {
	const [event, setEvent] = useState<PullRequestReviewEvent>("COMMENT")
	const [body, setBody] = useState("")
	const queryClient = useQueryClient()

	const submit = useMutation({
		mutationFn: () => coreBridge.submitReview({ repository: repo, number, event, body }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["pr:details", repo, number] })
			setBody("")
		},
	})

	return (
		<div className="submit-review">
			<div className="pr-detail-section-title">Submit review</div>
			<div className="review-event-options">
				{(["APPROVE", "COMMENT", "REQUEST_CHANGES"] as const).map((e) => (
					<label key={e} className="review-event-label">
						<input type="radio" name="review-event" value={e} checked={event === e} onChange={() => setEvent(e)} />
						{EVENT_LABELS[e]}
					</label>
				))}
			</div>
			<textarea className="comment-textarea" placeholder="Leave a comment (optional for Approve)" value={body} onChange={(e) => setBody(e.target.value)} />
			<button className="btn btn-primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
				{submit.isPending ? "Submitting…" : "Submit review"}
			</button>
		</div>
	)
}
