import { context } from "@ghui/keymap"

export interface AskAIPanelCtx {
	readonly closePanel: () => void
	readonly submit: () => void
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
	readonly scrollHistoryUp: () => void
	readonly scrollHistoryDown: () => void
}

const AskAI = context<AskAIPanelCtx>()

export const askAIPanelKeymap = AskAI(
	{ id: "ask-ai.escape", title: "Close", keys: ["escape"], run: (s) => s.closePanel() },
	{ id: "ask-ai.submit", title: "Submit", keys: ["ctrl+s"], run: (s) => s.submit() },
	{ id: "ask-ai.newline", title: "Insert newline", keys: ["return", "shift+return"], run: (s) => s.insertNewline() },

	{ id: "ask-ai.move-left", title: "Cursor left", keys: ["left", "ctrl+b"], run: (s) => s.moveLeft() },
	{ id: "ask-ai.move-right", title: "Cursor right", keys: ["right", "ctrl+f"], run: (s) => s.moveRight() },
	{ id: "ask-ai.move-up", title: "Cursor up", keys: ["up"], run: (s) => s.moveUp() },
	{ id: "ask-ai.move-down", title: "Cursor down", keys: ["down"], run: (s) => s.moveDown() },
	{ id: "ask-ai.line-start", title: "Line start", keys: ["home", "ctrl+a"], run: (s) => s.moveLineStart() },
	{ id: "ask-ai.line-end", title: "Line end", keys: ["end", "ctrl+e"], run: (s) => s.moveLineEnd() },
	{
		id: "ask-ai.word-back",
		title: "Word backward",
		keys: ["meta+b", "meta+left"],
		run: (s) => s.moveWordBackward(),
	},
	{
		id: "ask-ai.word-forward",
		title: "Word forward",
		keys: ["meta+f", "meta+right"],
		run: (s) => s.moveWordForward(),
	},

	{ id: "ask-ai.backspace", title: "Backspace", keys: ["backspace"], run: (s) => s.backspace() },
	{ id: "ask-ai.delete", title: "Delete", keys: ["delete", "ctrl+d"], run: (s) => s.deleteForward() },
	{
		id: "ask-ai.delete-word-back",
		title: "Delete word backward",
		keys: ["ctrl+w", "meta+backspace"],
		run: (s) => s.deleteWordBackward(),
	},
	{
		id: "ask-ai.delete-word-forward",
		title: "Delete word forward",
		keys: ["meta+delete"],
		run: (s) => s.deleteWordForward(),
	},
	{ id: "ask-ai.delete-to-line-start", title: "Delete to line start", keys: ["ctrl+u"], run: (s) => s.deleteToLineStart() },
	{ id: "ask-ai.delete-to-line-end", title: "Delete to line end", keys: ["ctrl+k"], run: (s) => s.deleteToLineEnd() },

	{ id: "ask-ai.history-up", title: "History up", keys: ["pageup"], run: (s) => s.scrollHistoryUp() },
	{ id: "ask-ai.history-down", title: "History down", keys: ["pagedown"], run: (s) => s.scrollHistoryDown() },
)
