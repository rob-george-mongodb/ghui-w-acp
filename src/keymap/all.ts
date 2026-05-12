import { context } from "@ghui/keymap"
import { changedFilesModalKeymap, type ChangedFilesModalCtx } from "./changedFilesModal.ts"
import { closeModalKeymap, type CloseModalCtx } from "./closeModal.ts"
import { commandPaletteKeymap, type CommandPaletteCtx } from "./commandPalette.ts"
import { commentModalKeymap, type CommentModalCtx } from "./commentModal.ts"
import { commentsViewKeymap, type CommentsViewCtx } from "./commentsView.ts"
import { commentThreadModalKeymap, type CommentThreadModalCtx } from "./commentThreadModal.ts"
import { deleteCommentModalKeymap, type DeleteCommentModalCtx } from "./deleteCommentModal.ts"
import { detailViewKeymap, type DetailViewCtx } from "./detailView.ts"
import { diffViewKeymap, type DiffViewCtx } from "./diffView.ts"
import { filterModeKeymap, type FilterModeCtx } from "./filterMode.ts"
import { labelModalKeymap, type LabelModalCtx } from "./labelModal.ts"
import { listNavKeymap, type ListNavCtx } from "./listNav.ts"
import { mergeModalKeymap, type MergeModalCtx } from "./mergeModal.ts"
import { openRepositoryModalKeymap, type OpenRepositoryModalCtx } from "./openRepositoryModal.ts"
import { pullRequestStateModalKeymap, type PullRequestStateModalCtx } from "./pullRequestStateModal.ts"
import { submitReviewModalKeymap, type SubmitReviewModalCtx } from "./submitReviewModal.ts"
import { themeModalKeymap, type ThemeModalCtx } from "./themeModal.ts"
import { findingsPanelKeymap, type FindingsPanelCtx } from "./findingsPanel.ts"
import { askAIPanelKeymap, type AskAIPanelCtx } from "./askAIPanel.ts"
import { sessionViewerPanelKeymap, type SessionViewerPanelCtx } from "./sessionViewerPanel.ts"
import { initiateReviewModalKeymap, type InitiateReviewModalCtx } from "./initiateReviewModal.ts"
import { findingEditModalKeymap, type FindingEditModalCtx } from "./findingEditModal.ts"
import { humanCommentModalKeymap, type HumanCommentModalCtx } from "./humanCommentModal.ts"
import { postFindingsModalKeymap, type PostFindingsModalCtx } from "./postFindingsModal.ts"

export interface AppCtx {
	// Active flags
	readonly closeModalActive: boolean
	readonly pullRequestStateModalActive: boolean
	readonly mergeModalActive: boolean
	readonly commentThreadModalActive: boolean
	readonly changedFilesModalActive: boolean
	readonly submitReviewModalActive: boolean
	readonly labelModalActive: boolean
	readonly themeModalActive: boolean
	readonly openRepositoryModalActive: boolean
	readonly commentModalActive: boolean
	readonly deleteCommentModalActive: boolean
	readonly commandPaletteActive: boolean
	readonly filterMode: boolean
	readonly diffFullView: boolean
	readonly detailFullView: boolean
	readonly commentsViewActive: boolean
	readonly initiateReviewModalActive?: boolean
	readonly findingEditModalActive?: boolean
	readonly humanCommentModalActive?: boolean
	readonly postFindingsModalActive?: boolean
	readonly findingsPanelActive?: boolean
	readonly askAIPanelActive?: boolean
	readonly sessionViewerPanelActive?: boolean

	// True whenever a modal/mode swallows raw text input (so q-quit, etc. are
	// disabled inside text-editing contexts).
	readonly textInputActive: boolean

	// Per-layer narrow contexts
	readonly closeModal: CloseModalCtx
	readonly pullRequestStateModal: PullRequestStateModalCtx
	readonly mergeModal: MergeModalCtx
	readonly commentThreadModal: CommentThreadModalCtx
	readonly changedFilesModal: ChangedFilesModalCtx
	readonly submitReviewModal: SubmitReviewModalCtx
	readonly labelModal: LabelModalCtx
	readonly themeModal: ThemeModalCtx
	readonly openRepositoryModal: OpenRepositoryModalCtx
	readonly commentModal: CommentModalCtx
	readonly deleteCommentModal: DeleteCommentModalCtx
	readonly commandPalette: CommandPaletteCtx
	readonly filterModeCtx: FilterModeCtx
	readonly diff: DiffViewCtx
	readonly detail: DetailViewCtx
	readonly commentsView: CommentsViewCtx
	readonly listNav: ListNavCtx
	readonly initiateReviewModal?: InitiateReviewModalCtx
	readonly findingEditModal?: FindingEditModalCtx
	readonly humanCommentModal?: HumanCommentModalCtx
	readonly postFindingsModal?: PostFindingsModalCtx
	readonly findingsPanel?: FindingsPanelCtx
	readonly askAIPanel?: AskAIPanelCtx
	readonly sessionViewerPanel?: SessionViewerPanelCtx

	// Always-on / app-level
	readonly openCommandPalette: () => void
	readonly handleQuitOrClose: () => void
}

const App = context<AppCtx>()

const modalActive = (a: AppCtx): boolean =>
	a.closeModalActive ||
	a.pullRequestStateModalActive ||
	a.mergeModalActive ||
	a.commentThreadModalActive ||
	a.changedFilesModalActive ||
	a.submitReviewModalActive ||
	a.labelModalActive ||
	a.themeModalActive ||
	a.openRepositoryModalActive ||
	a.commentModalActive ||
	a.deleteCommentModalActive ||
	a.commandPaletteActive ||
	!!a.initiateReviewModalActive ||
	!!a.findingEditModalActive ||
	!!a.humanCommentModalActive ||
	!!a.postFindingsModalActive

const inListMode = (a: AppCtx): boolean =>
	!modalActive(a) && !a.filterMode && !a.diffFullView && !a.detailFullView && !a.commentsViewActive && !a.findingsPanelActive && !a.askAIPanelActive && !a.sessionViewerPanelActive

export const appKeymap = App(
	// Always-on: command palette opener
	{ id: "command.open", title: "Open command palette", keys: ["ctrl+p", "meta+k"], run: (s) => s.openCommandPalette() },
	{ id: "command.open-help", title: "Open command palette", keys: ["?"], when: (s) => !s.textInputActive, run: (s) => s.openCommandPalette() },

	// Quit / close-active-modal — gated to "not editing text"
	{
		id: "app.quit-or-close",
		title: "Quit / close modal",
		keys: ["ctrl+c"],
		run: (s) => s.handleQuitOrClose(),
	},
	{
		id: "app.quit-or-close-q",
		title: "Quit / close modal",
		keys: ["q"],
		when: (s) => !s.textInputActive,
		run: (s) => s.handleQuitOrClose(),
	},

	// Modal layers
	closeModalKeymap.scope((a) => a.closeModalActive && a.closeModal),
	pullRequestStateModalKeymap.scope((a) => a.pullRequestStateModalActive && a.pullRequestStateModal),
	mergeModalKeymap.scope((a) => a.mergeModalActive && a.mergeModal),
	commentThreadModalKeymap.scope((a) => a.commentThreadModalActive && a.commentThreadModal),
	changedFilesModalKeymap.scope((a) => a.changedFilesModalActive && a.changedFilesModal),
	submitReviewModalKeymap.scope((a) => a.submitReviewModalActive && a.submitReviewModal),
	labelModalKeymap.scope((a) => a.labelModalActive && a.labelModal),
	themeModalKeymap.scope((a) => a.themeModalActive && a.themeModal),
	openRepositoryModalKeymap.scope((a) => a.openRepositoryModalActive && a.openRepositoryModal),
	commentModalKeymap.scope((a) => a.commentModalActive && a.commentModal),
	deleteCommentModalKeymap.scope((a) => a.deleteCommentModalActive && a.deleteCommentModal),
	commandPaletteKeymap.scope((a) => a.commandPaletteActive && a.commandPalette),
	filterModeKeymap.scope((a) => a.filterMode && a.filterModeCtx),

	// ACP modal layers
	initiateReviewModalKeymap.scope((a) => a.initiateReviewModalActive && a.initiateReviewModal),
	findingEditModalKeymap.scope((a) => a.findingEditModalActive && a.findingEditModal),
	humanCommentModalKeymap.scope((a) => a.humanCommentModalActive && a.humanCommentModal),
	postFindingsModalKeymap.scope((a) => a.postFindingsModalActive && a.postFindingsModal),

	// Full-view layers (only when no modal is on top)
	diffViewKeymap.scope((a) => a.diffFullView && !modalActive(a) && a.diff),
	detailViewKeymap.scope((a) => a.detailFullView && !modalActive(a) && a.detail),
	commentsViewKeymap.scope((a) => a.commentsViewActive && !modalActive(a) && a.commentsView),
	findingsPanelKeymap.scope((a) => a.findingsPanelActive && !modalActive(a) && a.findingsPanel),
	askAIPanelKeymap.scope((a) => a.askAIPanelActive && !modalActive(a) && a.askAIPanel),
	sessionViewerPanelKeymap.scope((a) => a.sessionViewerPanelActive && !modalActive(a) && a.sessionViewerPanel),

	// PR list nav
	listNavKeymap.scope((a) => inListMode(a) && a.listNav),
)
