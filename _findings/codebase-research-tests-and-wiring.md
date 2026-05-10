# Codebase Research: Tests and Wiring for Package Extraction

## Research Question
Which tests exercise non-UI logic vs TUI logic, where does app/runtime wiring instantiate services, and what are the implications for extracting a new package?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `glob **/*.test.{ts,tsx}` | 33 files | 22 in `test/`, 11 in `packages/keymap/test/` |
| 2 | Read all 22 top-level test files (first 15-40 lines each) | 22 | Classified by dependency on UI vs pure logic |
| 3 | Read `src/App.tsx` (L1-1019) | 1 | Monolithic component; all runtime wiring lives here |
| 4 | Read `src/index.tsx` | 1 | Bootstrap: renderer, React root, lazy App import |
| 5 | Read all 6 files in `src/services/` | 6 | Effect Context.Service pattern throughout |
| 6 | Read `src/config.ts`, `src/domain.ts`, `src/pullRequestCache.ts`, `src/pullRequestViews.ts` | 4 | Pure logic modules with zero UI deps |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/App.tsx` | **Monolith**: all Atom definitions, runtime layer composition, and the `App` component | L176-190 (layer wiring), L185-190 (`githubRuntime`), L274-378 (atom definitions), L469-532 (runtime-bound fn atoms), L704+ (`App` component) |
| 2 | `src/index.tsx` | Entry point: creates CLI renderer, bootstraps React root | L57-65 (renderer), L85-125 (`Bootstrap` component) |
| 3 | `src/services/GitHubService.ts` | Effect service wrapping `gh` CLI via `CommandRunner` | L1-60 (schemas), whole file (968 lines) |
| 4 | `src/services/CacheService.ts` | SQLite-backed cache, Effect service | L1-40 (schemas), 413 lines total |
| 5 | `src/services/CommandRunner.ts` | Subprocess runner, the only real I/O boundary | L1-30, 99 lines total |
| 6 | `src/services/BrowserOpener.ts` | Thin shell-out via CommandRunner | 39 lines |
| 7 | `src/services/Clipboard.ts` | Thin shell-out via CommandRunner | 47 lines |
| 8 | `src/domain.ts` | Pure types and constants (no deps) | 183 lines |
| 9 | `src/pullRequestViews.ts` | Pure view model logic (no deps except domain) | 42 lines |
| 10 | `src/pullRequestCache.ts` | Pure merge logic (no deps except domain) | 19 lines |
| 11 | `src/mergeActions.ts` | Pure merge-kind logic (depends on domain) | — |
| 12 | `src/errors.ts` | Pure error formatting | — |
| 13 | `src/themeConfig.ts` | Pure theme resolution | — |
| 14 | `src/themeStore.ts` | File I/O for config persistence (Effect) | — |
| 15 | `src/systemAppearance.ts` | OS appearance detection (subprocess) | — |
| 16 | `src/config.ts` | Reads env vars, `Effect.runSync` at module level | L23-27 |
| 17 | `src/appCommands.ts` | Pure command builder (no UI) | — |
| 18 | `test/scrolling.test.tsx` | **Only TUI integration test** — renders full App with mock services | L31-80, 347 lines |

## Test Classification

### Pure logic tests (no TUI/rendering dependency)
These test exported functions using plain `bun:test` assertions with no React or renderer:

| Test File | What it exercises | Source module |
|---|---|---|
| `test/domain.test.ts` | `pullRequestQueueSearchQualifier`, `viewCacheKey` | `src/domain.ts`, `src/pullRequestViews.ts` |
| `test/errors.test.ts` | `errorMessage` | `src/errors.ts` |
| `test/mergeActions.test.ts` | `availableMergeKinds`, `visibleMergeKinds`, `mergeActionCliArgs` | `src/mergeActions.ts` |
| `test/pullRequestCache.test.ts` | `mergeCachedDetails` | `src/pullRequestCache.ts` |
| `test/themeConfig.test.ts` | `normalizeThemeConfig`, `resolveThemeId` | `src/themeConfig.ts` |
| `test/systemAppearance.test.ts` | `appearanceFromLinuxSetting` | `src/systemAppearance.ts` |
| `test/themeStore.test.ts` | `loadStoredSystemThemeAutoReload` (file I/O via Effect) | `src/themeStore.ts` |
| `test/cacheService.test.ts` | `CacheService` round-trip with real SQLite in tmpdir | `src/services/CacheService.ts` |
| `test/githubServiceComments.test.ts` | `GitHubService` comment methods with fake `CommandRunner` | `src/services/GitHubService.ts` |
| `test/githubDiff.test.ts` | `pullRequestFilesToPatch` + `splitPatchFiles` | `src/services/GitHubService.ts`, `src/ui/diff.ts` |
| `test/appCommands.test.ts` | `buildAppCommands` filtering/scoping | `src/appCommands.ts` |
| `test/filterLabels.test.ts` | `filterLabels`, `filterChangedFiles` | `src/ui/modals.ts` |

### UI-adjacent logic tests (test pure functions exported from UI modules, but no rendering)

| Test File | What it exercises | Source module |
|---|---|---|
| `test/diffStacking.test.ts` | `buildStackedDiffFiles`, `scrollTopForVisibleLine`, anchor logic | `src/ui/diff.ts` |
| `test/inlineSegments.test.ts` | `inlineSegments`, `collectUrlPositions` | `src/ui/inlineSegments.ts` |
| `test/pullRequestList.test.ts` | `buildPullRequestListRows` | `src/ui/PullRequestList.tsx` |
| `test/pullRequestsDisplay.test.ts` | `pullRequestMetadataText`, `pullRequestRowDisplay`, `reviewIcon` | `src/ui/pullRequests.ts` |
| `test/detailsPane.test.ts` | `bodyPreview`, `getDetailHeaderHeight`, layout math | `src/ui/DetailsPane.tsx` |
| `test/commandPalette.test.ts` | `buildCommandPaletteRows`, scroll math | `src/ui/CommandPalette.tsx` |
| `test/singleLineInput.test.ts` | `editSingleLineInput`, `singleLineText` | `src/ui/singleLineInput.ts` |
| `test/commentEditor.test.ts` | Cursor movement, insertion, deletion | `src/ui/commentEditor.ts` |
| `test/colors.test.ts` | `filterThemeDefinitions`, `pairedThemeId` | `src/ui/colors.ts` |

### Full TUI integration test

| Test File | What it exercises |
|---|---|
| `test/scrolling.test.tsx` | Renders the entire `App` component inside `@opentui/core/testing` with mock data (`GHUI_MOCK_PR_COUNT=80`). Simulates key events to test scroll behavior, detail pane sync, and page-down/page-up. This is the **only test that renders the TUI**. |

## Code Path Map

### Runtime Layer Assembly: `src/App.tsx:L176-190`
1. Checks `GHUI_MOCK_PR_COUNT` env → picks `MockGitHubService.layer` or `GitHubService.layerNoDeps` (L176-182)
2. Checks same env → picks `CacheService.disabledLayer` or `CacheService.layerFromPath` (L183)
3. Merges layers: `GitHubService + CacheService + Clipboard + BrowserOpener`, provided by `CommandRunner.layer`, then `Observability.layer` (L185-189)
4. Creates `Atom.runtime(mergedLayer)` → `githubRuntime` (L185)
5. All service calls are bound to atoms via `githubRuntime.atom(...)` or `githubRuntime.fn(...)` (L284-532)

**Critical point**: All of this runs at **module top level** in `App.tsx`. Importing `App.tsx` triggers layer construction, env var reads, theme loading, and `Effect.runPromise` calls (L191-197). There is no factory or deferred initialization.

### Bootstrap: `src/index.tsx:L85-125`
1. `Bootstrap` component lazy-imports `App.tsx` and `@effect/atom-react`
2. Renders `<RegistryProvider><App/></RegistryProvider>`
3. Palette detection happens before App renders (L96-98)

### Service Dependency Graph
```
CommandRunner.layer (spawns subprocesses)
  ├── GitHubService.layerNoDeps (wraps `gh` CLI)
  ├── CacheService.layerFromPath (SQLite via @effect/sql-sqlite-bun)
  ├── BrowserOpener.layerNoDeps (shell open)
  └── Clipboard.layerNoDeps (pbcopy/xclip)
```

## Architectural Context

- **Module structure**: Flat `src/` with `services/`, `ui/`, `keyboard/`, `keymap/` subdirectories. No internal package boundaries.
- **Already-extracted package**: `packages/keymap/` — a standalone keymap dispatcher with its own `package.json` and 11 tests. Demonstrates the extraction pattern.
- **External deps**: `effect`, `@effect/atom-react`, `@opentui/core`, `@opentui/react`, `@effect/sql-sqlite-bun`, `@ghui/keymap`
- **Config**: `src/config.ts` reads env vars via `Effect.runSync` at import time. Would need to be parameterized for a library package.
- **Related tests**: `packages/keymap/test/*.test.ts` (11 files) — prior art for extracted package testing.

## Migration/Testing Implications

### Clean extraction candidates (zero UI deps)
These modules depend only on `effect` and `domain.ts`. They could move to a new package with no changes:
- `src/domain.ts`
- `src/pullRequestViews.ts`
- `src/pullRequestCache.ts`
- `src/mergeActions.ts`
- `src/errors.ts`
- `src/pullRequestLoad.ts`
- `src/config.ts` (needs `Effect.runSync` deferred or parameterized)
- `src/appCommands.ts` + `src/commands.ts`

### Service layer candidates (depend on Effect Context, no UI)
- `src/services/CommandRunner.ts`
- `src/services/GitHubService.ts`
- `src/services/CacheService.ts`
- `src/services/BrowserOpener.ts`
- `src/services/Clipboard.ts`
- `src/themeStore.ts`
- `src/systemAppearance.ts`
- `src/observability.ts`

### Tests that would move with extracted code
All "pure logic tests" listed above already import only from non-UI source modules. They'd move 1:1 with their source.

`test/cacheService.test.ts` and `test/githubServiceComments.test.ts` are true integration tests (real SQLite, fake CommandRunner). They'd also move cleanly.

### Blockers / coupling risks
1. **`App.tsx` module-level side effects** (L174-197): Layer composition, `Effect.runPromise`, and `setActiveTheme` all execute on import. Extracting services means `App.tsx` must import the new package and call a factory — the current top-level-execution pattern must change.
2. **`src/ui/diff.ts`** exports both rendering logic (used by `PullRequestDiffPane`) and pure diff-parsing logic (tested by `diffStacking.test.ts` and `githubDiff.test.ts`). Extraction would require splitting this file or accepting a UI dep in the new package.
3. **`src/ui/modals.ts`** exports `filterLabels` and `filterChangedFiles` (pure logic tested by `filterLabels.test.ts`) alongside modal React components. Same split issue.
4. **`src/config.ts`** uses `Effect.runSync` at module scope (L23-27). A library package should accept config as input rather than reading env at import time.
5. **`scrolling.test.tsx`** imports `App.tsx` directly and relies on `MockGitHubService` + env vars. After extraction, this test must import from both the new package and the TUI package. The mock service layer would need to be constructable from the new package's exports.

## Summary

The codebase has a clean separation between pure domain/service logic and TUI rendering — but that separation exists at the function level, not the module level. Most "UI" modules (`diff.ts`, `modals.ts`, `pullRequests.ts`, `DetailsPane.tsx`) export both pure functions and React components from the same file. The 22 top-level tests are overwhelmingly non-rendering: only `scrolling.test.tsx` touches the TUI. All runtime wiring (layer composition, atom creation, service instantiation) lives at the module top level of `App.tsx`, making it the primary refactoring target. The `packages/keymap/` extraction provides a working template for the build/test/publish pattern.
