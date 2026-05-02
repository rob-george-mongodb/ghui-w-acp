/**
 * Self-contained, compiling translation of ghui's keyboard surface into
 * @ghui/keymap. Mocks the minimal ghui types inline so the file typechecks
 * without depending on the rest of the project. Demonstrates how each
 * useScopedBindings layer in src/App.tsx becomes an importable Keymap value
 * over its own narrow context.
 */

import { command, Keymap } from "../src/index.ts"
import { type Scrollable, scrollCommands } from "../src/scroll.ts"

// ─── Mocked ghui types (minimal subset) ────────────────────────────────────

interface PullRequest {
	readonly url: string
	readonly state: "open" | "closed" | "merged"
}

type DiffCommentSide = "LEFT" | "RIGHT"

// ─── Per-modal contexts ────────────────────────────────────────────────────

export interface CloseModalCtx {
	readonly closeModal: () => void
	readonly confirmClose: () => void
}

export const closeModalKeymap: Keymap<CloseModalCtx> = Keymap.union(
	command({ id: "close-modal.cancel",  title: "Cancel",              keys: ["escape"], run: (s) => s.closeModal() }),
	command({ id: "close-modal.confirm", title: "Close pull request", keys: ["return"], run: (s) => s.confirmClose() }),
)

export interface MergeModalCtx {
	readonly availableActionCount: number
	readonly closeModal: () => void
	readonly confirmMerge: () => void
	readonly moveSelection: (delta: -1 | 1) => void
}

export const mergeModalKeymap: Keymap<MergeModalCtx> = Keymap.union(
	command({ id: "merge.cancel", title: "Cancel", keys: ["escape"], run: (s) => s.closeModal() }),
	command({
		id: "merge.confirm",
		title: "Merge",
		keys: ["return"],
		enabled: (s) => s.availableActionCount > 0 ? true : "No merge actions available.",
		run: (s) => s.confirmMerge(),
	}),
	command({ id: "merge.up",   title: "Up",   keys: ["k", "up"],   run: (s) => s.moveSelection(-1) }),
	command({ id: "merge.down", title: "Down", keys: ["j", "down"], run: (s) => s.moveSelection(1) }),
)

// ─── Diff full-view (regular mode) ─────────────────────────────────────────

export interface DiffCtx extends Scrollable {
	readonly hasOpenPullRequest: boolean
	readonly closeDiff: () => void
	readonly enterCommentMode: () => void
	readonly toggleView: () => void
	readonly toggleWrap: () => void
	readonly reload: () => void
	readonly nextFile: () => void
	readonly previousFile: () => void
	readonly openInBrowser: () => void
}

export const diffViewKeymap: Keymap<DiffCtx> = Keymap.union(
	scrollCommands<DiffCtx>(),
	command({ id: "diff.close",         title: "Close diff",       keys: ["escape", "return"], run: (s) => s.closeDiff() }),
	command({ id: "diff.comment-mode",  title: "Comment mode",     keys: ["c"],                run: (s) => s.enterCommentMode() }),
	command({ id: "diff.toggle-view",   title: "Toggle view",      keys: ["v"],                run: (s) => s.toggleView() }),
	command({ id: "diff.toggle-wrap",   title: "Toggle wrap",      keys: ["w"],                run: (s) => s.toggleWrap() }),
	command({ id: "diff.reload",        title: "Reload",           keys: ["r"],                run: (s) => s.reload() }),
	command({ id: "diff.next-file",     title: "Next file",        keys: ["]", "right", "l"],  run: (s) => s.nextFile() }),
	command({ id: "diff.previous-file", title: "Previous file",    keys: ["[", "left", "h"],   run: (s) => s.previousFile() }),
	command({ id: "diff.open-browser",  title: "Open in browser",  keys: ["o"],                run: (s) => s.openInBrowser() }),
)

// ─── Diff comment sub-mode (an entirely separate keymap) ───────────────────

export interface DiffCommentCtx {
	readonly halfPage: number
	readonly hasThread: boolean
	readonly exitCommentMode: () => void
	readonly toggleCommentMode: () => void
	readonly openInlineModal: () => void
	readonly openThreadModal: () => void
	readonly addComment: () => void
	readonly moveAnchor: (delta: number) => void
	readonly selectSide: (side: DiffCommentSide) => void
	readonly nextFile: () => void
	readonly previousFile: () => void
}

export const diffCommentKeymap: Keymap<DiffCommentCtx> = Keymap.union(
	command({ id: "diff-comment.exit",     title: "Exit comment mode", keys: ["escape"], run: (s) => s.exitCommentMode() }),
	command({ id: "diff-comment.toggle",   title: "Toggle comment mode", keys: ["c"],    run: (s) => s.toggleCommentMode() }),
	command({
		id: "diff-comment.open",
		title: "Open / reply",
		keys: ["return"],
		run: (s) => s.hasThread ? s.openThreadModal() : s.openInlineModal(),
	}),
	command({ id: "diff-comment.add",        title: "Add comment",   keys: ["a"],                                            run: (s) => s.addComment() }),
	command({ id: "diff-comment.up",         title: "Up",            keys: ["k", "up"],                                      run: (s) => s.moveAnchor(-1) }),
	command({ id: "diff-comment.down",       title: "Down",          keys: ["j", "down"],                                    run: (s) => s.moveAnchor(1) }),
	command({ id: "diff-comment.jump-up",    title: "Jump up",       keys: ["shift+k", "shift+up", "meta+k", "meta+up"],     run: (s) => s.moveAnchor(-8) }),
	command({ id: "diff-comment.jump-down",  title: "Jump down",     keys: ["shift+j", "shift+down", "meta+j", "meta+down"], run: (s) => s.moveAnchor(8) }),
	command({ id: "diff-comment.half-up",    title: "Half page up",  keys: ["pageup", "ctrl+u"],                             run: (s) => s.moveAnchor(-s.halfPage) }),
	command({ id: "diff-comment.half-down",  title: "Half page down", keys: ["pagedown", "ctrl+d", "ctrl+v"],                run: (s) => s.moveAnchor(s.halfPage) }),
	command({ id: "diff-comment.left-side",  title: "Old side",      keys: ["left", "h"],                                    run: (s) => s.selectSide("LEFT") }),
	command({ id: "diff-comment.right-side", title: "New side",      keys: ["right", "l"],                                   run: (s) => s.selectSide("RIGHT") }),
	command({ id: "diff-comment.next-file",  title: "Next file",     keys: ["]"],                                            run: (s) => s.nextFile() }),
	command({ id: "diff-comment.prev-file",  title: "Previous file", keys: ["["],                                            run: (s) => s.previousFile() }),
)

// ─── Detail full-view ──────────────────────────────────────────────────────

export interface DetailCtx extends Scrollable {
	readonly selectedPullRequest: PullRequest | null
	readonly closeDetail: () => void
	readonly openTheme: () => void
	readonly openDiff: () => void
	readonly closePullRequest: () => void
	readonly openLabels: () => void
	readonly openMerge: () => void
	readonly toggleDraft: () => void
	readonly refresh: () => void
	readonly openInBrowser: () => void
	readonly copyMetadata: () => void
}

const requirePullRequest = (s: DetailCtx) =>
	s.selectedPullRequest !== null ? true : "No pull request selected."

export const detailKeymap: Keymap<DetailCtx> = Keymap.union(
	scrollCommands<DetailCtx>(),
	command({ id: "detail.close",         title: "Close",       keys: ["escape", "return"], run: (s) => s.closeDetail() }),
	command({ id: "detail.theme",         title: "Theme",       keys: ["t"],                run: (s) => s.openTheme() }),
	command({ id: "detail.diff",          title: "Open diff",   keys: ["d"], enabled: requirePullRequest, run: (s) => s.openDiff() }),
	command({ id: "detail.close-pr",      title: "Close PR",    keys: ["x"],
		enabled: (s) => s.selectedPullRequest?.state === "open" ? true : "Pull request is not open.",
		run: (s) => s.closePullRequest() }),
	command({ id: "detail.labels",        title: "Labels",      keys: ["l"], enabled: requirePullRequest, run: (s) => s.openLabels() }),
	command({ id: "detail.merge",         title: "Merge",       keys: ["m", "shift+m"], enabled: requirePullRequest, run: (s) => s.openMerge() }),
	command({ id: "detail.toggle-draft",  title: "Toggle draft",keys: ["s", "shift+s"], enabled: requirePullRequest, run: (s) => s.toggleDraft() }),
	command({ id: "detail.refresh",       title: "Refresh",     keys: ["r"],                run: (s) => s.refresh() }),
	command({ id: "detail.open-browser",  title: "Open",        keys: ["o"], enabled: requirePullRequest, run: (s) => s.openInBrowser() }),
	command({ id: "detail.copy",          title: "Copy",        keys: ["y"], enabled: requirePullRequest, run: (s) => s.copyMetadata() }),
)

// ─── Global / PR-list nav ──────────────────────────────────────────────────

export interface ListNavCtx {
	readonly hasFilterQuery: boolean
	readonly clearFilter: () => void
	readonly openFilter: () => void
	readonly openTheme: () => void
	readonly switchQueueMode: (delta: 1 | -1) => void
	readonly stepSelected: (delta: number) => void
	readonly stepGroup: (delta: 1 | -1) => void
	readonly setSelected: (index: number) => void
	readonly visibleCount: number
}

export const listNavKeymap: Keymap<ListNavCtx> = Keymap.union(
	command({ id: "filter.open",  title: "Filter", keys: ["/"],         run: (s) => s.openFilter() }),
	command({ id: "filter.clear", title: "Clear filter", keys: ["escape"],
		enabled: (s) => s.hasFilterQuery ? true : "No filter to clear.",
		run: (s) => s.clearFilter() }),
	command({ id: "list.theme",   title: "Theme",  keys: ["t"],         run: (s) => s.openTheme() }),
	command({ id: "list.next-tab", title: "Next view", keys: ["tab"],   run: (s) => s.switchQueueMode(1) }),
	command({ id: "list.prev-tab", title: "Previous view", keys: ["shift+tab"], run: (s) => s.switchQueueMode(-1) }),
	command({ id: "list.step-up",   title: "Up",   keys: ["k", "up"],   run: (s) => s.stepSelected(-1) }),
	command({ id: "list.step-down", title: "Down", keys: ["j", "down"], run: (s) => s.stepSelected(1) }),
	command({ id: "list.group-prev", title: "Prev group", keys: ["[", "shift+k", "meta+up", "meta+k"], run: (s) => s.stepGroup(-1) }),
	command({ id: "list.group-next", title: "Next group", keys: ["]", "shift+j", "meta+down", "meta+j"], run: (s) => s.stepGroup(1) }),
	command({ id: "list.top",       title: "Top",       keys: ["g g"],    run: (s) => s.setSelected(0) }),
	command({ id: "list.bottom",    title: "Bottom",    keys: ["shift+g"], run: (s) => s.setSelected(Math.max(0, s.visibleCount - 1)) }),
)

// ─── App-level glue ────────────────────────────────────────────────────────

export interface AppCtx {
	readonly diffFullView: boolean
	readonly diffCommentMode: boolean
	readonly detailFullView: boolean
	readonly anyModalActive: boolean
	readonly closeModalActive: boolean
	readonly mergeModalActive: boolean
	readonly closeModal: CloseModalCtx
	readonly mergeModal: MergeModalCtx
	readonly diff: DiffCtx
	readonly diffComment: DiffCommentCtx
	readonly detail: DetailCtx
	readonly listNav: ListNavCtx
	readonly openCommandPalette: () => void
}

const inGlobal = (a: AppCtx): boolean =>
	!a.diffFullView && !a.detailFullView && !a.anyModalActive

export const appKeymap: Keymap<AppCtx> = Keymap.union(
	// Always-on: command palette
	command<AppCtx>({
		id: "command.open",
		title: "Open command palette",
		keys: ["ctrl+p", "meta+k"],
		run: (s) => s.openCommandPalette(),
	}),

	// Modal layers — each lifts its narrow context with a guard
	closeModalKeymap.contramapMaybe((a) => a.closeModalActive ? a.closeModal : null),
	mergeModalKeymap.contramapMaybe((a) => a.mergeModalActive ? a.mergeModal : null),

	// Full-view layers
	diffViewKeymap.contramapMaybe((a) => a.diffFullView && !a.diffCommentMode ? a.diff : null),
	diffCommentKeymap.contramapMaybe((a) => a.diffFullView && a.diffCommentMode ? a.diffComment : null),
	detailKeymap.contramapMaybe((a) => a.detailFullView ? a.detail : null),

	// PR-list nav: only when no modal/full-view is active
	listNavKeymap.contramapMaybe((a) => inGlobal(a) ? a.listNav : null),
)
