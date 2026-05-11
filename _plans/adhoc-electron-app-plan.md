# Electron App for ghui

## Problem Summary

ghui is a terminal UI for GitHub PR review built on OpenTUI/React. We want to ship an Electron desktop app that exposes the same user-facing functionality using the same `@ghui/core` backend, but rendered as a web UI instead of terminal UI. This gives users a native desktop experience with richer rendering (markdown, avatars, clickable links) without reimplementing business logic.

**Scope**: Three-pane layout (PR list → PR detail → comments). Diff viewing is **out of scope** — we'll leverage a separate system for that.

## Current Code Context

### Architecture (post-extraction)
The codebase has already been split:
- **`packages/core/` (`@ghui/core`)** — pure data/logic layer: domain types, `GitHubService` (uses `gh` CLI via `Bun.spawn`), `CacheService` (SQLite), command palette, merge actions, search. All Effect-TS.
- **`packages/keymap/` (`@ghui/keymap`)** — keymap definitions, framework-agnostic.
- **`src/`** — OpenTUI terminal renderer. `App.tsx` is ~4000 lines, tightly coupled to terminal rendering.

### Key Dependency: `gh` CLI
All GitHub API access goes through `CommandRunner` → `Bun.spawn` → `gh` CLI. This works fine in Electron (Node.js main process can spawn `gh`). Users already need `gh` installed and authenticated — same prerequisite.

### Key Dependency: Bun runtime
`CommandRunner` uses `Bun.spawn` and `CacheService` uses `@effect/sql-sqlite-bun`. Electron uses Node.js, not Bun. This is the primary technical challenge.

## Proposed Changes

### Package Structure

```
packages/
  core/           # existing — shared business logic
  keymap/         # existing — shared keybindings
  electron/       # NEW — Electron app
    src/
      main/       # Electron main process
        index.ts          # app lifecycle, window creation
        ipc.ts            # IPC bridge exposing core services to renderer
        nodeCommandRunner.ts  # CommandRunner impl using child_process
        nodeCacheService.ts   # CacheService impl using better-sqlite3
        coreLayer.ts          # Electron-specific layer composition
      preload/
        index.ts          # contextBridge exposing typed IPC to renderer
      renderer/   # React web UI
        index.html
        index.tsx         # entry point
        App.tsx           # main app component
        components/
          PRList.tsx       # left pane — grouped PR list
          PRDetail.tsx     # center pane — PR header, body, metadata
          CommentsPane.tsx # right pane — threaded comments (collapsible)
          PRListItem.tsx   # single PR row
          CommentThread.tsx
          MergeControls.tsx
          StatusChecks.tsx
          LabelBadge.tsx
          CommandPalette.tsx
          SearchBar.tsx
          RepoSelector.tsx  # repository picker (handles GitHub URLs / owner/repo)
          ErrorBoundary.tsx # auth/gh-not-found/network error states
        hooks/
          useCoreBridge.ts  # typed IPC wrappers
        styles/
          theme.css         # CSS variables from core theme system
      shared/
        ipcProtocol.ts    # typed IPC channel definitions (shared between main/renderer)
    electron-builder.yml    # packaging config
    package.json
```

### Phase 1: Node.js-compatible Core Services

The `@ghui/core` package assumes Bun APIs in two places:

1. **`CommandRunner`** — uses `Bun.spawn` and `Bun.readableStreamToText`. Need a Node.js impl using `child_process.spawn`.
2. **`CacheService`** — uses `@effect/sql-sqlite-bun`. Need a Node.js impl using `better-sqlite3` or `@effect/sql-sqlite-node`.

**Approach**: `makeCoreLayer()` in `runtime.ts` hardcodes `CommandRunner.layer` (Bun impl) and `CacheService.layerFromPath` (Bun SQLite). **We cannot use `makeCoreLayer()` directly.** Instead, the Electron app composes its own equivalent layer in `coreLayer.ts`:

```
makeElectronCoreLayer(options)
├── AppConfigService (from options.appConfig)
├── NodeCommandRunner.layer          ← child_process.spawn
├── GitHubService.layerNoDeps        ← CommandRunner + AppConfigService (reused from core)
├── NodeCacheService.layerFromPath   ← better-sqlite3
├── Clipboard.layerNoDeps            ← CommandRunner (reused from core)
├── BrowserOpener.layerNoDeps        ← CommandRunner (reused from core)
└── Observability.layer              ← reused from core
```

The `layerNoDeps` pattern on `GitHubService`, `Clipboard`, and `BrowserOpener` means these services depend only on the `CommandRunner` interface — not the Bun implementation. Swapping `CommandRunner` is sufficient for these. The `GitHubService` interface, domain types, search, commands, and merge actions are all imported from `@ghui/core` with no Bun dependency.

**Import-time risk**: `CommandRunner.ts` contains both the interface and the `Bun.spawn` implementation in the same file. Importing `CommandRunner` (the service tag) may trigger Bun global references at parse time in Node.js. If this happens, we have two options:
1. Split `CommandRunner` into interface + impl files in `@ghui/core` (minor core change).
2. Use the Electron bundler (Vite) to externalize/stub the Bun implementation and only import the service tag type.

Option 1 is cleaner; option 2 is a fallback.

### Phase 2: IPC Bridge

The Electron main process runs the Effect runtime with core services. The renderer communicates via IPC:

```
Renderer (React) ←contextBridge/IPC→ Main (Effect runtime + core services)
```

**IPC API surface** (maps 1:1 to `GitHubService` + `CacheService`):
- `pr:list(view)` → `PullRequestItem[]`
- `pr:details(repo, number)` → `PullRequestItem`
- `pr:comments(repo, number)` → `PullRequestComment[]`
- `pr:mergeInfo(repo, number)` → `PullRequestMergeInfo`
- `pr:merge(repo, number, action)` → `void`
- `pr:close(repo, number)` → `void`
- `pr:review(input)` → `void`
- `pr:toggleDraft(repo, number, isDraft)` → `void`
- `pr:labels:list(repo)` → labels
- `pr:labels:add/remove(repo, number, label)` → `void`
- `pr:comment:create/edit/delete(...)` → result
- `clipboard:copy(text)` → `void`
- `browser:open(url)` → `void`
- `cache:readQueue(viewer, view)` → `PullRequestLoad | null`
- `config:get()` → `AppConfig`
- `auth:user()` → `string`
- `auth:check()` → `{ ok: boolean; error?: string }` (startup health check)

Type safety via `shared/ipcProtocol.ts` — a TypeScript type defining all channel names, request shapes, and response shapes. Both main and preload import this type.

**Error serialization**: Effect errors (`CommandError`, `RateLimitError`, `JsonParseError`, `Schema.SchemaError`) contain non-serializable fields (arbitrary `unknown` causes, class instances). The IPC bridge must:
1. Catch all Effect errors in the main process handler.
2. Serialize them to a plain `{ _tag: string; message: string; retryAfterSeconds?: number }` envelope.
3. The renderer reconstructs typed error objects or handles them by `_tag` directly.

This is a lossy conversion — stack traces and nested causes are lost. For debugging, the main process logs full errors; the renderer gets actionable summaries.

**Concurrency**: IPC calls from the renderer should be debounced for rapid user interactions (e.g., clicking through PRs quickly). Use a simple "latest wins" pattern for data-fetching calls — cancel previous in-flight requests when a new one arrives for the same channel.

### Phase 3: React Web UI

Standard React 19 (same version as TUI) with a CSS-based layout. No terminal rendering library. Built with `electron-vite` (Vite under the hood).

**Three-pane layout:**
```
┌─────────────┬──────────────────────┬─────────────────┐
│  PR List    │   PR Detail          │  Comments       │
│  (left)     │   (center)           │  (right)        │
│             │                      │                 │
│ Search bar  │  Title, author       │  Threaded       │
│ View tabs   │  Status, checks      │  comments       │
│ Grouped PRs │  Body (markdown)     │  with reply     │
│             │  Labels, merge       │                 │
│             │  actions             │                 │
└─────────────┴──────────────────────┴─────────────────┘
```

- **Comments pane** is collapsible. When hidden, the detail pane expands to fill the space. Toggle via button or keyboard shortcut.
- PR list groups by repository (matching TUI behavior).
- Markdown rendered with `react-markdown` + `rehype-highlight` for code blocks.
- Command palette triggered by `Cmd+K` / `Ctrl+K` — reuses `filterCommands` from core. Diff-related commands (file navigation, thread navigation, ranges) are filtered out since diff is out of scope.

**Repository selection**: The left pane includes a repo selector that accepts:
- Repository names from the user's configured list
- GitHub URLs (parsed via `parseRepositoryInput` from core)
- `owner/repo` shorthand

**View switching**: Tab bar in left pane for `PullRequestView` modes:
- Queue modes: authored, review, assigned, mentioned
- Repository mode: specific repo's PRs

**Merge controls** in the detail pane:
- Fetch `PullRequestMergeInfo` via `pr:mergeInfo` to get actual `mergeable` status (not the `"unknown"` value from list data).
- Show available merge methods from `availableMergeKinds()`.
- Handle draft PRs: show "Mark ready" option when `requiresMarkReady()` returns true.
- Optimistic updates via `mergeActions.ts` `optimisticState` / `optimisticAutoMergeEnabled`.

**Context actions**: "Open in browser" and "Copy URL" buttons in the detail pane header (using `BrowserOpener` and `Clipboard` services via IPC).

**State management**: React Query (TanStack Query) for server state over IPC. This gives us:
- Automatic cache invalidation and refetching
- Optimistic updates for mutations
- Loading/error states
- Stale data indicators
- Background refetching on window focus

Local UI state (selected PR, pane visibility, command palette open) via React `useState` / `useReducer`.

**Error states**: `ErrorBoundary.tsx` handles:
- `gh` CLI not found → install instructions with link
- `gh` not authenticated → `gh auth login` instructions
- Network errors → "offline" indicator, show cached data if available
- Rate limiting → show countdown from `retryAfterSeconds`, auto-retry

**What maps from TUI to Electron:**

| TUI Feature | Electron Equivalent | Notes |
|---|---|---|
| PR list with repo groups | Left pane with collapsible repo sections | Same data, web styling |
| PR detail view | Center pane | Rendered markdown instead of terminal markdown |
| Comments view | Right pane (collapsible) | Threaded, with reply/edit/delete |
| Diff view | **OUT OF SCOPE** | Link to external diff viewer |
| Command palette | Overlay modal, Cmd+K | Same `filterCommands` logic, diff commands filtered out |
| Merge modal | Inline controls in detail pane | Merge method picker + merge button |
| View switching (repo/authored/review/etc) | Tab bar in left pane | Same `PullRequestView` types |
| Repository picker | Repo selector component | Uses `parseRepositoryInput` from core |
| Keyboard navigation | Keyboard shortcuts + click | `@ghui/keymap` reused for shortcuts |
| Theme system | CSS variables from core theme | Light/dark via system preference |
| Open in browser | Button in detail header | Same `BrowserOpener` service |
| Copy URL | Button in detail header | Same `Clipboard` service |

### Phase 4: Packaging & Distribution

- **electron-builder** for packaging macOS (dmg/zip). Linux and Windows are stretch goals.
- Auto-update via `electron-updater` + GitHub Releases is a follow-up, not MVP.
- Prerequisite: `gh` CLI installed and authenticated (same as TUI). App runs `auth:check()` on startup and shows a helpful setup wizard if `gh` is not found or not authenticated.
- **SQLite file locking**: Electron and TUI should use separate cache file paths to avoid contention if both run simultaneously.

## Acceptance Criteria

1. Electron app launches and displays a PR list for the user's configured views.
2. Selecting a PR shows its detail (title, author, body as rendered markdown, labels, status checks, merge state).
3. Comments pane shows threaded comments for the selected PR with reply, edit, and delete capabilities.
4. Hiding the comments pane causes the detail pane to expand.
5. Merge/close/draft-toggle actions work from the detail pane.
6. Command palette opens with `Cmd+K`, filters commands, and executes them.
7. View switching between queue modes and repository views works.
8. Graceful error handling for missing `gh`, auth failures, and network errors.
9. macOS packaging produces a runnable `.app`.

## Verification Plan

1. **Contract tests for Node.js services**: Write tests that verify `NodeCommandRunner` and `NodeCacheService` satisfy the same behavioral contracts as their Bun counterparts. These are new tests, not existing ones (no contract test suite exists today).
2. **IPC round-trip tests**: Use Electron's testing utilities (`@playwright/test` with Electron support) to verify typed IPC calls return correct data shapes.
3. **Error path tests**: Verify the app handles `gh` not found (mock PATH), auth failure (mock `gh auth status`), and rate limiting (mock `gh api` response) gracefully.
4. **E2E smoke test**: Playwright test that launches the Electron app, verifies the PR list renders, selects a PR, verifies detail pane populates, toggles comments pane. Uses `MockGitHubService` from core.
5. **Packaging smoke**: `electron-builder` produces a runnable `.app` on macOS, app launches without errors.
6. **No regressions**: `bun run test`, `bun run typecheck`, `bun run lint` all pass — no changes to core or TUI packages.

## Risks / Open Questions

### Resolved
- **Bun → Node.js gap**: Isolated to `CommandRunner` and `CacheService` layers. Both have standard Node.js equivalents.
- **`makeCoreLayer` not reusable**: Electron composes its own layer using `layerNoDeps` exports from individual services. No core changes needed for this.
- **State management**: React Query for server state, React state for local UI state.

### Open Questions
1. **Should we vendor `gh` CLI or require it pre-installed?** Recommendation: require pre-installed (same as TUI). Vendoring adds complexity and update burden. Yes AI - assume it is pre-installed
2. **Import-time Bun references**: Need to verify whether importing `CommandRunner` (service tag only) from `@ghui/core` triggers Bun globals at parse time in Node.js. If yes, a minor core refactor to split interface from impl is needed. Low risk — easy fix either way. Figure it out when implementing AI - I'm not sure.
3. **Polling vs push for PR list refresh**: TUI polls on user action. Electron could do timed auto-refresh via React Query's `refetchInterval`. Recommend starting with refetch-on-window-focus (React Query default) and adding configurable interval later.
AI - we want to have a refresh button. No polling or implict refresh.

## Relevant Files / Research References

- `_findings/codebase-research-core-package.md` — full core package architecture
- `_findings/codebase-research-ui-layer.md` — TUI architecture analysis
- `_findings/codebase-research-prior-extraction.md` — prior extraction work on `aislop_yolo_extract_basically_decoupled_stuff` branch
- `packages/core/src/runtime.ts` — `makeCoreLayer()` factory (L1-29)
- `packages/core/src/services/CommandRunner.ts` — Bun.spawn impl, interface + impl in same file (L48-117)
- `packages/core/src/services/CacheService.ts` — SQLite impl (L270-363)
- `packages/core/src/services/GitHubService.ts` — 24-method interface (L588-617), `layerNoDeps` pattern
- `packages/core/src/domain.ts` — all domain types
- `packages/core/src/mergeActions.ts` — merge kind definitions, `availableMergeKinds`, `requiresMarkReady`
- `packages/core/src/pullRequestViews.ts` — `parseRepositoryInput`, view types
- `packages/core/src/commands.ts` — `filterCommands`, command palette infrastructure
- `packages/core/src/appCommands.ts` — ~35 concrete commands (some diff-specific, to be filtered)
- `src/App.tsx` — TUI app (reference for feature parity)

## Implementation Order

1. **Scaffold Electron package** — `packages/electron/`, electron-vite, basic window
2. **Node.js CommandRunner** — `child_process.spawn` impl of `CommandRunner` service
3. **Node.js CacheService** — `better-sqlite3` impl of `CacheService` service
4. **Electron core layer** — `makeElectronCoreLayer()` composing Node.js service impls with reused `layerNoDeps` services
5. **IPC bridge + protocol** — typed IPC channel definitions, main process handlers, preload bridge, error serialization
6. **PR list pane** — left pane with search, view switching, repo selector, grouped PRs
7. **PR detail pane** — center pane with markdown body, metadata, status checks, context actions
8. **Comments pane** — right pane with threaded comments, reply/edit/delete, collapsible
9. **Merge controls** — merge method picker, merge/close/draft toggle with optimistic updates
10. **Command palette** — Cmd+K overlay with diff commands filtered out
11. **Error handling** — startup health check, auth errors, network errors, rate limiting
12. **Packaging** — electron-builder config for macOS
