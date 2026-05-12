import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { PullRequestComment } from "@ghui/core"
import { orderCommentsForDisplay, findReviewThreadRootId } from "@ghui/core"
import { coreBridge } from "../hooks/useCoreBridge.js"
import { CommentThread } from "./CommentThread.js"

interface CommentsPaneProps {
	repo: string
	number: number
	onClose: () => void
}

export const CommentsPane = ({ repo, number, onClose }: CommentsPaneProps) => {
	const queryClient = useQueryClient()
	const commentsKey = ["pr:comments", repo, number] as const
	const prKey = `${repo}#${number}`

	const { data: comments, isLoading } = useQuery({
		queryKey: commentsKey,
		queryFn: () => coreBridge.listPullRequestComments(repo, number),
	})

	const { data: currentUser } = useQuery({
		queryKey: ["auth:user"],
		queryFn: () => coreBridge.getAuthenticatedUser(),
	})

	const { data: trackedComments } = useQuery({
		queryKey: ["comment:tracked", prKey],
		queryFn: () => coreBridge.listTrackedComments(prKey),
	})

	const trackedByCommentId = useMemo(() => new Map((trackedComments ?? []).map((t) => [t.commentId, t])), [trackedComments])

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: commentsKey })
		queryClient.invalidateQueries({ queryKey: ["comment:tracked", prKey] })
	}

	const replyToThread = useMutation({
		mutationFn: ({ threadRootComment, body }: { threadRootComment: PullRequestComment; body: string }) => {
			if (threadRootComment._tag === "review-comment") {
				const rootId = findReviewThreadRootId(comments ?? [], threadRootComment.id)
				return coreBridge.replyToReviewComment(repo, number, rootId, body)
			}
			return coreBridge.createIssueComment(repo, number, body)
		},
		onSuccess: (result) => {
			invalidate()
			void coreBridge.trackComment(result.id, prKey)
		},
	})

	const editComment = useMutation({
		mutationFn: ({ id, tag, body }: { id: string; tag: PullRequestComment["_tag"]; body: string }) =>
			tag === "review-comment" ? coreBridge.editComment(repo, id, body) : coreBridge.editIssueComment(repo, id, body),
		onSuccess: invalidate,
	})

	const deleteComment = useMutation({
		mutationFn: ({ id, tag }: { id: string; tag: PullRequestComment["_tag"] }) =>
			tag === "review-comment" ? coreBridge.deleteComment(repo, id) : coreBridge.deleteIssueComment(repo, id),
		onSuccess: invalidate,
	})

	const resolveComment = useMutation({
		mutationFn: (commentId: string) => coreBridge.resolveComment(commentId),
		onSuccess: invalidate,
	})

	const ordered = useMemo(() => orderCommentsForDisplay(comments ?? []), [comments])

	const threads = useMemo(() => {
		const result: { rootComment: PullRequestComment; comments: PullRequestComment[] }[] = []
		for (const { comment, indent } of ordered) {
			if (indent === 0) {
				result.push({ rootComment: comment, comments: [comment] })
			} else {
				const last = result[result.length - 1]
				if (last) last.comments.push(comment)
			}
		}
		return result
	}, [ordered])

	return (
		<div className="comments-pane-inner">
			<div className="comments-pane-header">
				<span className="comments-pane-title">Comments</span>
				<button className="btn-sm btn-ghost" onClick={onClose}>
					✕
				</button>
			</div>

			{isLoading && <div className="loading-message">Loading comments…</div>}

			{!isLoading && threads.length === 0 && <div className="loading-message">No comments yet</div>}

			<div className="comments-pane-list">
				{threads.map((thread) => (
					<CommentThread
						key={thread.rootComment.id}
						comments={thread.comments}
						currentUser={currentUser ?? null}
						trackedByCommentId={trackedByCommentId}
						onReply={(body) => replyToThread.mutate({ threadRootComment: thread.rootComment, body })}
						onEdit={(id, tag, body) => editComment.mutate({ id, tag, body })}
						onDelete={(id, tag) => deleteComment.mutate({ id, tag })}
						onResolve={(commentId) => resolveComment.mutate(commentId)}
					/>
				))}
			</div>
		</div>
	)
}
