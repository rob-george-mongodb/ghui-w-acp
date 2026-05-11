import { context, type Scrollable, scrollCommands } from "@ghui/keymap"

export interface FindingsPanelCtx extends Scrollable {
	readonly closePanel: () => void
	readonly stepUp: () => void
	readonly stepDown: () => void
	readonly acceptFinding: () => void
	readonly rejectFinding: () => void
	readonly editFinding: () => void
	readonly openPostFindings: () => void
	readonly openHumanComment: () => void
}

const FindingsPanel = context<FindingsPanelCtx>()

export const findingsPanelKeymap = FindingsPanel(
	scrollCommands<FindingsPanelCtx>(),
	{ id: "findings-panel.close", title: "Close findings", keys: ["escape", "f"], run: (s) => s.closePanel() },
	{ id: "findings-panel.up", title: "Up", keys: ["up", "k"], run: (s) => s.stepUp() },
	{ id: "findings-panel.down", title: "Down", keys: ["down", "j"], run: (s) => s.stepDown() },
	{ id: "findings-panel.accept", title: "Accept finding", keys: ["a"], run: (s) => s.acceptFinding() },
	{ id: "findings-panel.reject", title: "Reject finding", keys: ["x"], run: (s) => s.rejectFinding() },
	{ id: "findings-panel.edit", title: "Edit finding", keys: ["e"], run: (s) => s.editFinding() },
	{ id: "findings-panel.post", title: "Post accepted findings", keys: ["p"], run: (s) => s.openPostFindings() },
	{ id: "findings-panel.write", title: "Write human comment", keys: ["w"], run: (s) => s.openHumanComment() },
)
