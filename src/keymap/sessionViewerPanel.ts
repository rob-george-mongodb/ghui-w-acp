import { context, type Scrollable, scrollCommands } from "@ghui/keymap"

export interface SessionViewerPanelCtx extends Scrollable {
	readonly closePanel: () => void
	readonly stepUp: () => void
	readonly stepDown: () => void
	readonly selectSession: () => void
}

const SessionViewerPanel = context<SessionViewerPanelCtx>()

export const sessionViewerPanelKeymap = SessionViewerPanel(
	scrollCommands<SessionViewerPanelCtx>(),
	{ id: "session-viewer.close", title: "Close sessions", keys: ["escape", "v"], run: (s) => s.closePanel() },
	{ id: "session-viewer.up", title: "Up", keys: ["up", "k"], run: (s) => s.stepUp() },
	{ id: "session-viewer.down", title: "Down", keys: ["down", "j"], run: (s) => s.stepDown() },
	{ id: "session-viewer.select", title: "Expand session", keys: ["return"], run: (s) => s.selectSession() },
)
