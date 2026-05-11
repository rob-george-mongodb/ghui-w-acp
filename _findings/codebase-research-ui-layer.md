# Codebase Research: UI Layer Architecture

## Research Question
What is the UI architecture of the `src/` directory? What framework, components, views/screens, and data flow patterns exist?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `src/` directory listing | 6 entries | App.tsx, index.tsx, keyboard/, keymap/, standalone.ts, ui/ |
| 2 | Read `src/ui/` directory listing | 18 entries | All UI component files |
| 3 | Read package.json for framework deps | 1 file | @opentui/core, @opentui/react, react 19, effect 4 |
| 4 | Read keymap/ directory listing | 19 entries | One keymap file per view/modal context |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/standalone.ts` | CLI entry point — handles `--help`/`--version`, then imports `index.js` | L1-55 |
| 2 | `src/index.tsx` | Bootstrap — creates OpenTUI renderer, lazy-loads App, shows startup logo | L1-125 |
| 3 | `src/App.tsx` | **Monolithic app component** — 3982 lines, all state atoms, all views, all keybindings | L1-3982 |
| 4 | `src/ui/PullRequestList.tsx` | PR list rendering — grouped by repo, with filter bar, load-more row | L1-210 |
| 5 | `src/ui/DetailsPane.tsx` | PR detail view — header (title, labels, checks, review status) + body (description with markdown) | L1-805 |
| 6 | `src/ui/PullRequestDiffPane.tsx` | Diff view — split/unified diff with file headers, syntax highlighting, inline comments | L1-289 |
| 7 | `src/ui/CommentsPane.tsx` | Comments view — threaded comment display with reply indentation | L1-284 |
| 8 | `src/ui/comments.tsx` | Comment rendering primitives — segments, wrapping, timestamps, quoted replies | L1-204 |
| 9 | `src/ui/modals.tsx` | All modal definitions and rendering — 13 modal types as Effect `Data.TaggedEnum` | L1-1218 |
| 10 | `src/ui/CommandPalette.tsx` | Command palette modal | — |
| 11 | `src/ui/colors.ts` | Theme system — theme definitions, active theme, color accessors | — |
| 12 | `src/ui/primitives.tsx` | Low-level UI building blocks — Divider, Filler, fitCell, PlainLine, ModalFrame, etc. | — |
| 13 | `src/ui/diff.ts` | Diff computation — stacked diff files, comment anchors, whitespace modes | — |
| 14 | `src/ui/commentEditor.ts` | Multi-line text editor state machine for comment composition | — |
| 15 | `src/ui/singleLineInput.ts` | Single-line text input handling (filter bar, search fields) | — |
| 16 | `src/keymap/all.ts` | Master keymap composition from all context-specific keymaps | — |
| 17 | `src/keyboard/opentuiAdapter.ts` | Bridges OpenTUI keyboard events to the keymap system | — |

## Architecture Overview

### Rendering Framework
- **OpenTUI** (`@opentui/core` v0.2.1, `@opentui/react` v0.2.1) — a terminal UI framework with a React reconciler
- **React 19** — standard React component model, hooks, JSX
- JSX uses OpenTUI intrinsic elements: `<box>`, `<span>`, `<scrollbox>`, `<diff>` (native diff renderable)
- Not Ink — this is a distinct framework with its own renderer (`createCliRenderer`), alternate screen support, focus reporting, and mouse events

### State Management
- **Effect 4 Atoms** (`effect/unstable/reactivity/Atom`) — reactive atoms for all application state
- **`@effect/atom-react`** — React bindings (`useAtom`, `useAtomValue`, `useAtomSet`, `useAtomRefresh`, `RegistryProvider`)
- `githubRuntime.atom(...)` / `githubRuntime.fn(...)` — atoms that run Effect services (GitHubService, CacheService, Clipboard, BrowserOpener) via a shared runtime layer built from `makeCoreLayer`

### Data Flow: Core → UI
1. `makeCoreLayer({ appConfig, mock })` creates the Effect service layer (L198-203 in App.tsx)
2. `githubRuntime = Atom.runtime(layer)` wraps it as an atom runtime
3. Service calls are defined as atoms: `pullRequestsAtom`, `pullRequestDetailsAtom`, `pullRequestDiffAtom`, etc.
4. These atoms call `GitHubService.use(github => github.listOpenPullRequestPage(...))` etc.
5. React components consume via `useAtomValue(pullRequestsAtom)` → `AsyncResult<PullRequestLoad>`
6. Derived atoms compute filtered/grouped/selected state: `filteredPullRequestsAtom` → `visibleGroupsAtom` → `visiblePullRequestsAtom` → `selectedPullRequestAtom`

### Bootstrap Flow
```
standalone.ts → index.tsx → createCliRenderer() → createRoot(renderer).render(<Bootstrap />)
  Bootstrap shows <StartupLogo> while lazy-loading App.tsx
  Then renders <RegistryProvider><App /></RegistryProvider>
```

### Views / Screens
The app is a **single-screen TUI** with multiple view modes controlled by boolean atoms:

| View | Controlled By | Description |
|------|---------------|-------------|
| **Wide split layout** | `isWideLayout` (terminal ≥ 100 cols) | Left: PR list, Right: Detail pane |
| **Narrow layout** | `!isWideLayout` | Detail on top, PR list below |
| **Detail full view** | `detailFullViewAtom` | Full-screen PR detail (header + scrollable body) |
| **Diff full view** | `diffFullViewAtom` | Full-screen diff with file navigation, split/unified toggle |
| **Comments view** | `commentsViewActiveAtom` | Full-screen threaded comments pane |

### PR List Display (`PullRequestList.tsx`)
- PRs grouped by repository with `◆ repo-name` headers
- Each row shows: review icon, PR number, title, check status, age
- Filter bar for text search across title/repo/branch/number
- "Load more" row for pagination
- Row types: `title | filter | message | group | pull-request | load-more`

### PR Detail Display (`DetailsPane.tsx`)
- **Header**: PR number, repo, title, author, branch, labels, review status, CI checks, diff stats, comment count
- **Body**: PR description rendered with inline markdown (code blocks with syntax highlighting, inline code, links, quotes)
- Scrollable body with configurable line limits
- Click-to-open URLs

### Diff Display (`PullRequestDiffPane.tsx`)
- Uses OpenTUI's native `<diff>` element with syntax highlighting via tree-sitter
- Split view (side-by-side) or unified view
- File-by-file navigation with sticky file headers
- Inline comment threads on diff lines (comment anchors with colored highlights)
- Whitespace mode toggle (show/ignore)
- Word wrap mode toggle

### Comments Display (`CommentsPane.tsx`)
- Threaded display with indent levels (max 3 levels, 4 cols per indent)
- Supports both issue comments and review comments
- Review comments show file path context
- Issue comment threading via quote-header heuristic (`> @author wrote:`)
- Virtual "+ Add new comment" row at bottom
- Comment body wrapped to pane width

### Modals (13 types, `modals.tsx`)
Modals are an Effect `Data.TaggedEnum` union (`Modal`):
- `Label` — add/remove labels
- `Merge` — merge PR (method selection, confirmation)
- `Close` — close PR confirmation
- `PullRequestState` — toggle draft status
- `Comment` — compose new comment (multi-line editor)
- `DeleteComment` — confirm comment deletion
- `CommentThread` — view/reply to diff comment thread
- `ChangedFiles` — file picker for diff navigation
- `SubmitReview` — submit review (approve/request changes/comment)
- `Theme` — theme picker
- `CommandPalette` — fuzzy command search
- `OpenRepository` — switch repository view
- `None` — no modal

### Keyboard System
- `src/keymap/` — 19 context-specific keymap files (one per view/modal)
- `src/keymap/all.ts` — composes all keymaps into unified `appKeymap`
- `src/keyboard/opentuiAdapter.ts` — bridges OpenTUI key events to `@ghui/keymap`
- Keymaps are context-aware: different bindings active depending on current view/modal state

### Key Architectural Notes
- **App.tsx is monolithic**: ~4000 lines, single component with all state, effects, and rendering logic
- **No router**: view switching is via boolean atoms, not URL-based routing
- **Atom-heavy**: ~50+ atoms defined at module scope for all state
- **Effect integration**: GitHub API calls, caching, clipboard, browser opening all via Effect services
- **Responsive**: layout adapts at 100-col breakpoint between wide (split) and narrow (stacked)

## Summary
The UI layer is a React 19 application rendered via OpenTUI (a terminal UI framework with its own React reconciler). All state lives in Effect Atoms, and core services (GitHub API, caching) are consumed through `githubRuntime.atom()`/`.fn()` wrappers. The app is a single monolithic component (`App.tsx`, ~4000 lines) that manages a PR list view, detail view, diff view, comments view, and 13 modal types. The `src/ui/` directory contains pure rendering components while `App.tsx` owns all state and keyboard handling logic.
