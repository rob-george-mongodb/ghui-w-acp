# Codebase Research: Command/Keymap Surface Around PR Views

## Research Question
Map the command/keymap surface around pull request views — queue-mode switching, command palette entries, hard-coded view assumptions, header labels, and mock/dev behavior — to identify everything that would need updates if a new inbox-style view or grouped list mode is added.

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `switchQueueMode\|QueueMode\|queueMode` in `src/**/*.ts` | 1 file | Only in `listNav.ts` (3 hits) |
| 2 | `PullRequestView\|activePullRequestViews\|viewLabel\|viewMode` in `packages/core` | 6 files | Core view type + helpers |
| 3 | `buildAppCommands\|AppCommand\|defineCommand\|CommandScope` in `packages/core` | 3 files | Command registry |
| 4 | `pullRequestQueueModes\|pullRequestQueueLabels\|PullRequestQueueMode` in `packages/core` | 5 files | Hardcoded mode list |
| 5 | `switchViewTo\|switchQueueMode` in `src/**/*.tsx` | 1 file (App.tsx) | 7 hits |
| 6 | `FooterHints\|footer\|activeView\|viewLabel` in `src/ui/*.tsx` | 6 files | Footer/header rendering |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/domain.ts` | **Hardcoded queue modes array and labels** | L8-18 |
| 2 | `packages/core/src/pullRequestViews.ts` | **PullRequestView type, view factories, tab cycling** | L1-42 |
| 3 | `packages/core/src/appCommands.ts` | **Command palette entries generated per view** | L75-188 |
| 4 | `packages/core/src/commands.ts` | **CommandScope type (hardcoded union)** | L1 |
| 5 | `src/keymap/listNav.ts` | **Tab/shift-tab queue mode switching + all list keybindings** | L1-121 |
| 6 | `src/keymap/all.ts` | **`inListMode` gate, AppCtx layering** | L83, L126 |
| 7 | `src/App.tsx` | **Header line, switchViewTo/switchQueueMode, appCommands wiring, listNav ctx** | L1065-1066, L1118-1138, L2933-2970, L3364-3386 |
| 8 | `src/ui/FooterHints.tsx` | **Footer hint bar (no view-specific hints for tab switching)** | L67-92 |
| 9 | `packages/core/src/services/MockGitHubService.ts` | **filterByView only checks "repository" vs catch-all** | L91-94 |
| 10 | `packages/core/src/services/CacheService.ts` | **CachedPullRequestViewSchema validates view modes** | L64-65 |

## Code Path Map

### Entry Point: Tab/Shift-Tab cycling views (`src/keymap/listNav.ts:L43-44`)
1. Keymap binds `tab`/`shift+tab` → `ListNavCtx.switchQueueMode(delta)` at L43-44
2. `switchQueueMode` in `App.tsx:L1136-1138` calls `switchViewTo(nextView(activeView, activeViews, delta))`
3. `nextView()` in `packages/core/src/pullRequestViews.ts:L22-28` cycles through the `views` array by index + delta (mod length)
4. `activePullRequestViews()` at L17-20 constructs the views array: optional Repository view + all `pullRequestQueueModes` mapped to Queue views
5. `pullRequestQueueModes` is a **hardcoded const array** at `packages/core/src/domain.ts:L8`: `["authored", "review", "assigned", "mentioned"]`

### Entry Point: Command palette view-switch commands (`packages/core/src/appCommands.ts:L178-188`)
1. `buildAppCommands` iterates `activeViews` (same `activePullRequestViews()` output) at L178
2. Creates one `defineCommand` per view with id `view.${mode}` or `view.repository`
3. Keywords include `[viewMode(view), viewLabel(view), "queue", "view"]`
4. Disabled when already showing that view

### Header label rendering (`src/App.tsx:L1065-1066`)
1. `headerLeft = username ? \`GHUI  ${username}  ${viewLabel(activeView)}\` : \`GHUI  ${viewLabel(activeView)}\``
2. `viewLabel()` at `packages/core/src/pullRequestViews.ts:L30` returns `pullRequestQueueLabels[mode]` for Queue views or `repository` string for Repository views
3. `pullRequestQueueLabels` at `domain.ts:L12-18` maps modes to display strings like `"authored"`, `"review requested"`, `"assigned"`, `"mentioned"`, `"repository"`

### List mode gate (`src/keymap/all.ts:L83`)
1. `inListMode = !modalActive(a) && !a.filterMode && !a.diffFullView && !a.detailFullView && !a.commentsViewActive`
2. This is the predicate for activating list navigation keybindings (L126)
3. **No concept of an "inbox" vs "flat list" mode** — list mode is binary (you're in the list or not)

### Mock/dev behavior (`packages/core/src/services/MockGitHubService.ts:L91-94`)
1. `filterByView(mode, repository, source)` — if `mode === "repository"`, filters by repo; otherwise returns all items unchanged
2. **No per-queue-mode filtering in mock** — authored/review/assigned/mentioned all return the same items
3. Mock PR generation at `App.tsx:L195-202`: `GHUI_MOCK_PR_COUNT` and `GHUI_MOCK_REPO_COUNT` env vars

### Cache schema validation (`packages/core/src/services/CacheService.ts:L64-65`)
1. `CachedPullRequestViewSchema` uses `Schema.Literals(pullRequestQueueModes)` for Queue mode validation
2. Adding a new mode requires updating this schema or cached views with the new mode will fail to decode

## Architectural Context

- **Module**: View/queue system spans `packages/core/src/` (types + logic) and `src/` (React rendering + keybindings)
- **Dependencies**: `@ghui/keymap` package provides the `context()` and keymap infrastructure
- **Key type**: `PullRequestView` is a discriminated union of `Repository | Queue`; Queue's `mode` is constrained to `PullRequestUserQueueMode` (`"authored" | "review" | "assigned" | "mentioned"`)
- **Configuration**: No feature flags control which views are available; the set is hardcoded in `domain.ts:L8`
- **Related Tests**: `packages/core/test/domain.test.ts` (viewCacheKey tests), `packages/core/test/appCommands.test.ts` (command building tests)

## Summary of Touch Points for an Inbox View

### If adding a new queue mode (e.g. "inbox"):
1. **`packages/core/src/domain.ts:L8-18`** — Add to `pullRequestQueueModes` array and `pullRequestQueueLabels` map. Also update `pullRequestQueueSearchQualifier` (L20-30) with the GitHub search qualifier.
2. **`packages/core/src/pullRequestViews.ts`** — `PullRequestUserQueueMode` type auto-widens from the const array. `activePullRequestViews()` and `viewLabel()` auto-pick-up new modes. No changes needed.
3. **`packages/core/src/appCommands.ts:L178-188`** — Command palette entries auto-generated from `activeViews`. No changes needed.
4. **`packages/core/src/services/CacheService.ts:L64-65`** — `CachedPullRequestViewSchema` uses `Schema.Literals(pullRequestQueueModes)` so it auto-picks-up. No changes needed.
5. **`packages/core/src/services/MockGitHubService.ts:L91-94`** — `filterByView` doesn't differentiate user queue modes; all return the same data. May need inbox-specific mock data.
6. **`packages/core/src/services/GitHubService.ts:L459`** — `searchQuery()` uses `pullRequestQueueSearchQualifier`; would auto-pick-up if qualifier is added.

### If adding a structurally different view (e.g. grouped inbox, not just another queue mode):
1. **`packages/core/src/pullRequestViews.ts:L3-5`** — Extend the `PullRequestView` discriminated union with a new tag (e.g. `| { _tag: "Inbox"; ... }`)
2. **Every function in `pullRequestViews.ts`** — `viewMode`, `viewRepository`, `viewCacheKey`, `viewEquals`, `activePullRequestViews`, `nextView`, `viewLabel` all switch on `_tag` and would need new branches.
3. **`src/App.tsx:L1065`** — Header line uses `viewLabel(activeView)`.
4. **`src/App.tsx:L1118-1138`** — `switchViewTo` and `switchQueueMode` would need awareness of the new view type.
5. **`src/App.tsx:L278`** — `cacheViewerFor` switches on `_tag`.
6. **`src/keymap/listNav.ts`** — `switchQueueMode` stays the same (it just calls `switchViewTo(nextView(...))`), but if inbox needs different keybindings (e.g. no merge/close on list items), a new keymap layer or conditional gates would be needed.
7. **`src/keymap/all.ts:L83`** — `inListMode` may need updating if the inbox view has different modal/layer semantics.
8. **`src/ui/FooterHints.tsx:L67-83`** — `defaultHints` doesn't show tab-switching hints; if inbox needs different footer hints, add a branch in `footerHints()`.
9. **`packages/core/src/commands.ts:L1`** — `CommandScope` may need a new scope (e.g. `"Inbox"`) if inbox-specific commands are added.
10. **`packages/core/src/services/CacheService.ts:L64`** — `CachedPullRequestViewSchema` would need a new union member for the new `_tag`.
