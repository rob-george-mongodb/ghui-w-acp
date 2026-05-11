import { context } from "@ghui/keymap"

export interface HumanCommentModalCtx {
	readonly closeModal: () => void
	readonly save: () => void
	readonly insertNewline: () => void
	readonly moveLeft: () => void
	readonly moveRight: () => void
	readonly moveUp: () => void
	readonly moveDown: () => void
	readonly moveLineStart: () => void
	readonly moveLineEnd: () => void
	readonly moveWordBackward: () => void
	readonly moveWordForward: () => void
	readonly backspace: () => void
	readonly deleteForward: () => void
	readonly deleteWordBackward: () => void
	readonly deleteWordForward: () => void
	readonly deleteToLineStart: () => void
	readonly deleteToLineEnd: () => void
}

const HumanComment = context<HumanCommentModalCtx>()

export const humanCommentModalKeymap = HumanComment(
	{ id: "human-comment.escape", title: "Cancel", keys: ["escape"], run: (s) => s.closeModal() },
	{ id: "human-comment.save", title: "Save", keys: ["ctrl+s", "return"], run: (s) => s.save() },
	{ id: "human-comment.newline", title: "Insert newline", keys: ["shift+return"], run: (s) => s.insertNewline() },

	{ id: "human-comment.move-left", title: "Cursor left", keys: ["left", "ctrl+b"], run: (s) => s.moveLeft() },
	{ id: "human-comment.move-right", title: "Cursor right", keys: ["right", "ctrl+f"], run: (s) => s.moveRight() },
	{ id: "human-comment.move-up", title: "Cursor up", keys: ["up"], run: (s) => s.moveUp() },
	{ id: "human-comment.move-down", title: "Cursor down", keys: ["down"], run: (s) => s.moveDown() },
	{ id: "human-comment.line-start", title: "Line start", keys: ["home", "ctrl+a"], run: (s) => s.moveLineStart() },
	{ id: "human-comment.line-end", title: "Line end", keys: ["end", "ctrl+e"], run: (s) => s.moveLineEnd() },
	{
		id: "human-comment.word-back",
		title: "Word backward",
		keys: ["meta+b", "meta+left"],
		run: (s) => s.moveWordBackward(),
	},
	{
		id: "human-comment.word-forward",
		title: "Word forward",
		keys: ["meta+f", "meta+right"],
		run: (s) => s.moveWordForward(),
	},

	{ id: "human-comment.backspace", title: "Backspace", keys: ["backspace"], run: (s) => s.backspace() },
	{ id: "human-comment.delete", title: "Delete", keys: ["delete", "ctrl+d"], run: (s) => s.deleteForward() },
	{
		id: "human-comment.delete-word-back",
		title: "Delete word backward",
		keys: ["ctrl+w", "meta+backspace"],
		run: (s) => s.deleteWordBackward(),
	},
	{
		id: "human-comment.delete-word-forward",
		title: "Delete word forward",
		keys: ["meta+delete"],
		run: (s) => s.deleteWordForward(),
	},
	{ id: "human-comment.delete-to-line-start", title: "Delete to line start", keys: ["ctrl+u"], run: (s) => s.deleteToLineStart() },
	{ id: "human-comment.delete-to-line-end", title: "Delete to line end", keys: ["ctrl+k"], run: (s) => s.deleteToLineEnd() },
)
