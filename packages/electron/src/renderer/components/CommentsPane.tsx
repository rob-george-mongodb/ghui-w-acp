import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { PullRequestComment } from "@ghui/core"
import { isReviewComment } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"
import { CommentThread } from "./CommentThread.js"

interface CommentsPaneProps {
	repo: string
	number: number
	onClose: () => void
}

type Thread = { id: string; comments: PullRequestComment[] }

const buildThreads = (comments: readonly PullRequestComment[]): Thread[] => {
	const threads: Thread[] = []
	const replyMap = new Map<string, Thread>()

	for (const comment of comments) {
		if (isReviewComment(comment) && comment.inReplyTo) {
			const parent = replyMap.get(comment.inReplyTo)
			if (parent) {
				parent.comments.push(comment)
				replyMap.set(comment.id, parent)
				continue
			}
		}
		const thread: Thread = { id: comment.id, comments: [comment] }
		threads.push(thread)
		replyMap.set(comment.id, thread)
	}

	return threads
}

export const CommentsPane = ({ repo, number, onClose }: CommentsPaneProps) => {
	const queryClient = useQueryClient()
	const commentsKey = ["pr:comments", repo, number] as const

	const { data: comments, isLoading } = useQuery({
		queryKey: commentsKey,
		queryFn: () => coreBridge.listPullRequestComments(repo, number),
	})

	const { data: currentUser } = useQuery({
		queryKey: ["auth:user"],
		queryFn: () => coreBridge.getAuthenticatedUser(),
	})

	const invalidate = () => queryClient.invalidateQueries({ queryKey: commentsKey })

	const createComment = useMutation({
		mutationFn: (body: string) => coreBridge.createIssueComment(repo, number, body),
		onSuccess: invalidate,
	})

	const editComment = useMutation({
		mutationFn: ({ id, body }: { id: string; body: string }) => coreBridge.editComment(repo, id, body),
		onSuccess: invalidate,
	})

	const deleteComment = useMutation({
		mutationFn: (id: string) => coreBridge.deleteComment(repo, id),
		onSuccess: invalidate,
	})

	const threads = useMemo(() => buildThreads(comments ?? []), [comments])

	return (
		<div className="comments-pane-inner">
			<div className="comments-pane-header">
				<span className="comments-pane-title">Comments</span>
				<button className="btn-sm btn-ghost" onClick={onClose}>✕</button>
			</div>

			{isLoading && <div className="loading-message">Loading comments…</div>}

			{!isLoading && threads.length === 0 && (
				<div className="loading-message">No comments yet</div>
			)}

			<div className="comments-pane-list">
				{threads.map((thread) => (
					<CommentThread
						key={thread.id}
						comments={thread.comments}
						currentUser={currentUser ?? null}
						onReply={(body) => createComment.mutate(body)}
						onEdit={(id, body) => editComment.mutate({ id, body })}
						onDelete={(id) => deleteComment.mutate(id)}
					/>
				))}
			</div>
		</div>
	)
}
