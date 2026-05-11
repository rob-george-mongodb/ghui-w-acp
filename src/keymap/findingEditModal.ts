import { context } from "@ghui/keymap"

export interface FindingEditModalCtx {
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

const FindingEdit = context<FindingEditModalCtx>()

export const findingEditModalKeymap = FindingEdit(
	{ id: "finding-edit.escape", title: "Cancel", keys: ["escape"], run: (s) => s.closeModal() },
	{ id: "finding-edit.save", title: "Save", keys: ["ctrl+s", "return"], run: (s) => s.save() },
	{ id: "finding-edit.newline", title: "Insert newline", keys: ["shift+return"], run: (s) => s.insertNewline() },

	{ id: "finding-edit.move-left", title: "Cursor left", keys: ["left", "ctrl+b"], run: (s) => s.moveLeft() },
	{ id: "finding-edit.move-right", title: "Cursor right", keys: ["right", "ctrl+f"], run: (s) => s.moveRight() },
	{ id: "finding-edit.move-up", title: "Cursor up", keys: ["up"], run: (s) => s.moveUp() },
	{ id: "finding-edit.move-down", title: "Cursor down", keys: ["down"], run: (s) => s.moveDown() },
	{ id: "finding-edit.line-start", title: "Line start", keys: ["home", "ctrl+a"], run: (s) => s.moveLineStart() },
	{ id: "finding-edit.line-end", title: "Line end", keys: ["end", "ctrl+e"], run: (s) => s.moveLineEnd() },
	{
		id: "finding-edit.word-back",
		title: "Word backward",
		keys: ["meta+b", "meta+left"],
		run: (s) => s.moveWordBackward(),
	},
	{
		id: "finding-edit.word-forward",
		title: "Word forward",
		keys: ["meta+f", "meta+right"],
		run: (s) => s.moveWordForward(),
	},

	{ id: "finding-edit.backspace", title: "Backspace", keys: ["backspace"], run: (s) => s.backspace() },
	{ id: "finding-edit.delete", title: "Delete", keys: ["delete", "ctrl+d"], run: (s) => s.deleteForward() },
	{
		id: "finding-edit.delete-word-back",
		title: "Delete word backward",
		keys: ["ctrl+w", "meta+backspace"],
		run: (s) => s.deleteWordBackward(),
	},
	{
		id: "finding-edit.delete-word-forward",
		title: "Delete word forward",
		keys: ["meta+delete"],
		run: (s) => s.deleteWordForward(),
	},
	{ id: "finding-edit.delete-to-line-start", title: "Delete to line start", keys: ["ctrl+u"], run: (s) => s.deleteToLineStart() },
	{ id: "finding-edit.delete-to-line-end", title: "Delete to line end", keys: ["ctrl+k"], run: (s) => s.deleteToLineEnd() },
)
