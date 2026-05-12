import { useState } from "react"
import type { PullRequestComment } from "@ghui/core"
import { formatRelativeDate } from "@ghui/core"

interface CommentThreadProps {
	comments: readonly PullRequestComment[]
	currentUser: string | null
	onReply: (body: string) => void
	onEdit: (commentId: string, body: string) => void
	onDelete: (commentId: string) => void
}

const initials = (name: string) =>
	name
		.split(/[\s-_]+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("")

const CommentBody = ({
	comment,
	currentUser,
	onEdit,
	onDelete,
}: {
	comment: PullRequestComment
	currentUser: string | null
	onEdit: (commentId: string, body: string) => void
	onDelete: (commentId: string) => void
}) => {
	const [editing, setEditing] = useState(false)
	const [editBody, setEditBody] = useState(comment.body)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const isOwn = currentUser !== null && comment.author === currentUser

	if (editing) {
		return (
			<div className="comment-edit">
				<textarea className="comment-textarea" value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
				<div className="comment-edit-actions">
					<button
						className="btn-sm btn-primary"
						disabled={!editBody.trim()}
						onClick={() => {
							onEdit(comment.id, editBody)
							setEditing(false)
						}}
					>
						Save
					</button>
					<button
						className="btn-sm"
						onClick={() => {
							setEditing(false)
							setEditBody(comment.body)
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="comment-content">
			<div className="comment-body">{comment.body}</div>
			{isOwn && (
				<div className="comment-actions">
					<button className="btn-sm btn-ghost" onClick={() => setEditing(true)}>
						Edit
					</button>
					{confirmDelete ? (
						<>
							<button
								className="btn-sm btn-danger"
								onClick={() => {
									onDelete(comment.id)
									setConfirmDelete(false)
								}}
							>
								Confirm
							</button>
							<button className="btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
								Cancel
							</button>
						</>
					) : (
						<button className="btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
							Delete
						</button>
					)}
				</div>
			)}
		</div>
	)
}

export const CommentThread = ({ comments, currentUser, onReply, onEdit, onDelete }: CommentThreadProps) => {
	const [replying, setReplying] = useState(false)
	const [replyBody, setReplyBody] = useState("")

	const handleSubmitReply = () => {
		if (!replyBody.trim()) return
		onReply(replyBody)
		setReplyBody("")
		setReplying(false)
	}

	return (
		<div className="comment-thread">
			{comments.map((comment) => (
				<div key={comment.id} className="comment-item">
					<div className="comment-header">
						<span className="comment-avatar">{initials(comment.author)}</span>
						<span className="comment-author">{comment.author}</span>
						{comment.createdAt && <span className="comment-timestamp">{formatRelativeDate(comment.createdAt)}</span>}
					</div>
					<CommentBody comment={comment} currentUser={currentUser} onEdit={onEdit} onDelete={onDelete} />
				</div>
			))}
			{replying ? (
				<div className="comment-reply-form">
					<textarea className="comment-textarea" placeholder="Write a reply…" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} autoFocus />
					<div className="comment-edit-actions">
						<button className="btn-sm btn-primary" disabled={!replyBody.trim()} onClick={handleSubmitReply}>
							Reply
						</button>
						<button
							className="btn-sm"
							onClick={() => {
								setReplying(false)
								setReplyBody("")
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<button className="btn-sm btn-ghost comment-reply-btn" onClick={() => setReplying(true)}>
					Reply
				</button>
			)}
		</div>
	)
}
