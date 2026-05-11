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
        hooks/
          useCoreBridge.ts  # typed IPC wrappers
        styles/
          theme.css         # CSS variables from core theme system
    electron-builder.yml    # packaging config
    package.json
```

### Phase 1: Node.js-compatible Core Services

The `@ghui/core` package assumes Bun APIs in two places:

1. **`CommandRunner`** — uses `Bun.spawn`. Need a Node.js impl using `child_process.spawn`.
2. **`CacheService`** — uses `@effect/sql-sqlite-bun`. Need a Node.js impl using `better-sqlite3` or `@effect/sql-sqlite-node`.

**Approach**: Create alternative `Layer` implementations in `packages/electron/src/main/` that satisfy the same `Context.Service` interfaces. `makeCoreLayer()` already accepts layers — we provide Node-compatible ones. No changes to `@ghui/core` needed if we can swap layers. If `makeCoreLayer` doesn't support layer overrides, we compose our own equivalent layer.

### Phase 2: IPC Bridge

The Electron main process runs the Effect runtime with core services. The renderer communicates via IPC:

```
Renderer (React) ←IPC→ Main (Effect runtime + core services)
```

**IPC API surface** (maps 1:1 to `GitHubService` + `CacheService`):
- `pr:list(view)` → `PullRequestItem[]`
- `pr:details(repo, number)` → `PullRequestItem`
- `pr:comments(repo, number)` → `PullRequestComment[]`
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

Type safety via a shared protocol type that both main and renderer import.

### Phase 3: React Web UI

Standard React 19 (same version as TUI) with a CSS-based layout. No terminal rendering library.

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

- **Comments pane** is collapsible. When hidden, the detail pane expands to fill the space.
- PR list groups by repository (matching TUI behavior).
- Markdown rendered with a proper markdown renderer (e.g., `react-markdown`).
- Command palette triggered by `Cmd+K` / `Ctrl+K` — reuses `filterCommands` from core.

**What maps from TUI to Electron:**

| TUI Feature | Electron Equivalent | Notes |
|---|---|---|
| PR list with repo groups | Left pane with collapsible repo sections | Same data, web styling |
| PR detail view | Center pane | Rendered markdown instead of terminal markdown |
| Comments view | Right pane (collapsible) | Threaded, with reply/edit/delete |
| Diff view | **OUT OF SCOPE** | Will link to external diff viewer |
| Command palette | Overlay modal, Cmd+K | Same `filterCommands` logic |
| Merge modal | Inline controls in detail pane | Merge method picker + merge button |
| View switching (repo/authored/review/etc) | Tab bar or dropdown in left pane | Same `PullRequestView` types |
| Keyboard navigation | Keyboard shortcuts + click | `@ghui/keymap` reused for shortcuts |
| Theme system | CSS variables from core theme | Light/dark via system preference |

### Phase 4: Packaging & Distribution

- **electron-builder** for packaging macOS (dmg/zip), Linux (AppImage/deb), Windows (nsis).
- Auto-update via `electron-updater` + GitHub Releases.
- Prerequisite: `gh` CLI installed and authenticated (same as TUI). App should show a helpful error if `gh` is not found.

## Verification Plan

1. **Unit tests**: Node.js `CommandRunner` and `CacheService` implementations pass the same interface contract tests as Bun versions.
2. **Integration test**: IPC bridge round-trip — main process serves core data, renderer receives correct typed responses.
3. **Manual smoke test**: Launch Electron app, see PR list populated, select a PR, see detail + comments.
4. **Packaging smoke**: `electron-builder` produces a runnable .app on macOS.
5. **Existing tests still pass**: `bun run test`, `bun run typecheck`, `bun run lint` — no regressions in core or TUI.

## Risks / Open Questions

### Resolved
- **Bun → Node.js gap**: Isolated to `CommandRunner` and `CacheService` layers. Both have standard Node.js equivalents.

### Open Questions
1. **Should we vendor `gh` CLI or require it pre-installed?** Recommendation: require pre-installed (same as TUI). Vendoring adds complexity and update burden.
2. **Build tooling for renderer**: Vite (via `electron-vite`) vs. webpack? Recommendation: `electron-vite` — modern, fast, good Electron integration.
3. **State management in renderer**: Effect atoms (same as TUI) or simpler React state + React Query over IPC? The TUI uses ~50 Effect atoms. For the web UI, React Query or Zustand over IPC may be simpler since we don't have the same tight render-loop constraints.
4. **Should `@ghui/core` be modified to support pluggable `CommandRunner`/`CacheService` via dependency injection, or should Electron compose its own layer?** The Effect Layer system already supports this — Electron just provides its own layers. Likely no core changes needed.
5. **Polling vs push for PR list refresh**: TUI polls on user action. Electron could do timed auto-refresh. Worth considering but not blocking.
6. **Window management**: Single window? Multiple windows for different views? Recommendation: single window to start.

## Relevant Files / Research References

- `_findings/codebase-research-core-package.md` — full core package architecture
- `_findings/codebase-research-ui-layer.md` — TUI architecture analysis
- `_findings/codebase-research-prior-extraction.md` — prior extraction work on `aislop_yolo_extract_basically_decoupled_stuff` branch
- `packages/core/src/runtime.ts` — `makeCoreLayer()` factory (L1-29)
- `packages/core/src/services/CommandRunner.ts` — Bun.spawn impl (L59-117)
- `packages/core/src/services/CacheService.ts` — SQLite impl (L270-363)
- `packages/core/src/services/GitHubService.ts` — 24-method interface (L588-617)
- `packages/core/src/domain.ts` — all domain types
- `src/App.tsx` — TUI app (reference for feature parity)

## Implementation Order

1. **Scaffold Electron package** — `packages/electron/`, electron-vite, basic window
2. **Node.js CommandRunner** — `child_process.spawn` impl of `CommandRunner` service
3. **Node.js CacheService** — `better-sqlite3` impl of `CacheService` service
4. **IPC bridge** — typed IPC protocol, main process Effect runtime
5. **PR list pane** — left pane with search, view switching, grouped PRs
6. **PR detail pane** — center pane with markdown body, metadata, status
7. **Comments pane** — right pane with threaded comments, reply/edit/delete
8. **Merge controls** — merge method picker, merge/close/draft toggle
9. **Command palette** — Cmd+K overlay
10. **Packaging** — electron-builder config, GitHub release integration
