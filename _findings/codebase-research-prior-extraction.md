# Codebase Research: Prior AI Extraction Branch

## Research Question
What extraction/decoupling work was done on `origin/aislop_yolo_extract_basically_decoupled_stuff`, what's reusable, and what state is it in?

## Branch Overview

The branch is **1 commit ahead** of `main` (which is at `0.7.1`). The entire extraction was done in a single commit `e43d30e` ("refactor: extract shared logic into @ghui/core"), preceded by 4 planning commits. The branch diverged from `main` at `bc27987` (chore: release 0.7.1).

**Total delta**: +2299 / -982 lines across 77 files.

## What Was Done

### 1. Created `packages/core` workspace package (`@ghui/core`)

A new private workspace package following the same pattern as the existing `@ghui/keymap`:
- `packages/core/package.json` — private, raw TS exports, local `test` and `typecheck` scripts
- `packages/core/tsconfig.json` — standalone config mirroring keymap
- `packages/core/src/index.ts` — curated barrel export (68 lines)

### 2. Moved pure/service modules (filesystem moves, not rewrites)

These files were moved from `src/` → `packages/core/src/` with minimal changes:

| Source | Destination | Changes |
|--------|-------------|---------|
| `src/domain.ts` | `packages/core/src/domain.ts` | None |
| `src/date.ts` | `packages/core/src/date.ts` | None |
| `src/errors.ts` | `packages/core/src/errors.ts` | None |
| `src/commands.ts` | `packages/core/src/commands.ts` | None |
| `src/appCommands.ts` | `packages/core/src/appCommands.ts` | Import path fix |
| `src/mergeActions.ts` | `packages/core/src/mergeActions.ts` | None |
| `src/observability.ts` | `packages/core/src/observability.ts` | None |
| `src/pullRequestViews.ts` | `packages/core/src/pullRequestViews.ts` | None |
| `src/pullRequestLoad.ts` | `packages/core/src/pullRequestLoad.ts` | None |
| `src/pullRequestCache.ts` | `packages/core/src/pullRequestCache.ts` | None |
| `src/themeConfig.ts` | `packages/core/src/themeConfig.ts` | Import path changes |
| `src/themeStore.ts` | `packages/core/src/themeStore.ts` | Import path changes |
| `src/systemAppearance.ts` | `packages/core/src/systemAppearance.ts` | Import path changes |
| `src/services/*` (all 6) | `packages/core/src/services/*` | `GitHubService` got config changes |

### 3. Created new extracted modules (real seam cuts)

These are **new files** containing logic extracted from UI-coupled source:

| File | Extracted From | Content |
|------|---------------|---------|
| `packages/core/src/diff.ts` (418 lines) | `src/ui/diff.ts` | Diff types, patch parsing, whitespace normalization, stats, anchor/navigation. Accepts optional `resolveFiletype` callback instead of importing `@opentui/core` directly. |
| `packages/core/src/theme.ts` (103 lines) | `src/ui/colors.ts` | `ThemeId`, `ThemeTone`, theme metadata catalog, `isThemeId`, `themeToneForThemeId`, `pairedThemeId`, filtering helpers. Palette/rendering state stays in TUI. |
| `packages/core/src/search.ts` (173 lines) | `src/ui/modals.tsx` | `filterLabels`, `filterChangedFiles`, and search helpers extracted from component file. |
| `packages/core/src/runtime.ts` (29 lines) | `src/App.tsx` | `makeCoreLayer()` — assembles the Effect service layer (GitHub/Mock, Cache, Clipboard, BrowserOpener, CommandRunner, Observability). |
| `packages/core/src/config.ts` (35 lines) | `src/config.ts` (rewritten) | Replaced eager singleton with `AppConfig` type + `resolveAppConfig` Effect + `AppConfigService` context. |

### 4. Updated consumers

- **`src/App.tsx`**: All imports changed from local paths to `@ghui/core`. Config singleton replaced with `await Effect.runPromise(resolveAppConfig)`. Layer assembly replaced with `makeCoreLayer()`.
- **`src/ui/diff.ts`**: Shrunk from ~700 lines to ~200 lines (kept only render/layout/syntax helpers).
- **`src/ui/colors.ts`**: Theme identity/metadata extracted; kept palette constants and mutable `colors` singleton.
- **`src/ui/modals.tsx`**: Search helpers extracted; kept component code.
- **`src/ui/*.tsx`**: Various import path updates.
- **`packages/keymap/src/*`**: Several import path adjustments.

### 5. Moved tests with their code

11 test files moved from `test/` → `packages/core/test/` with import path updates.

### 6. Updated root tooling

Root `package.json` scripts now cover all workspace packages:
- `test` runs `bun test ./test/` + keymap tests + core tests
- `typecheck` runs root + keymap + core
- `lint` and `format`/`format:check` include `packages/*/src/`
- `@ghui/core` added to `devDependencies`

## What's Reusable

**Almost everything.** The branch represents a complete, coherent extraction. The key design decisions are sound:

1. **`resolveFiletype` callback pattern** in diff parsing — avoids `@opentui/core` dependency in the core package
2. **`makeCoreLayer()` factory** — clean service assembly API
3. **`AppConfig` type replacing singleton** — proper Effect-style config resolution
4. **Theme metadata vs palette separation** — correct architectural boundary
5. **Barrel export** — curated, not `export *` of everything

## State Assessment

| Aspect | Status |
|--------|--------|
| Planning | ✅ Thorough — 289-line plan with 6 research artifacts |
| Implementation | ✅ Complete in single commit |
| Merge conflicts | ⚠️ Branch is based on 0.7.1; main is also at 0.7.1 so should be clean currently, but will drift |
| Tests verified | ❓ Unknown — no CI status checked, single commit suggests it may have been done in one shot |
| Smoke test | ❓ Unknown |
| Code review | ❌ No PR exists |

## Risks / Concerns

1. **Single massive commit** — 77 files, +2299/-982 lines in one commit makes review harder and bisection impossible if something broke.
2. **`_plans/` and `_findings/` directories** — 7 research/planning files that probably shouldn't ship to main.
3. **No PR** — work exists only as a branch; no review feedback captured.
4. **Keymap package also modified** — import paths in `packages/keymap/src/*.ts` were changed; need to verify these are correct.

## Search Trail

| # | Search Query / Pattern | Notes |
|---|------------------------|-------|
| 1 | `git log origin/aislop_yolo_extract_basically_decoupled_stuff --oneline -30` | 1 refactor commit + 4 plan commits on top of 0.7.1 |
| 2 | `git diff main...branch --stat` | 77 files changed |
| 3 | `git diff` on `packages/core/src/index.ts` | Curated barrel with 68 lines |
| 4 | `git diff` on `packages/core/package.json`, `tsconfig.json` | Standard workspace package setup |
| 5 | `git diff` on `_plans/adhoc-core-package-extraction-plan.md` | 289-line detailed plan |
| 6 | `git diff` on `packages/core/src/runtime.ts`, `diff.ts`, `theme.ts`, `search.ts` | New extracted modules |
| 7 | `git diff` on `src/App.tsx` | Consumer updated to use `@ghui/core` |
| 8 | `git diff` on `package.json` | Root scripts updated for workspace coverage |
| 9 | `git diff` on `packages/core/src/config.ts` | Singleton replaced with Effect-style config |

## Summary

The branch contains a **complete, well-planned extraction** of all non-UI logic into `packages/core` (`@ghui/core`). It moved ~20 pure modules, created 5 new seam-cut modules (diff, theme, search, runtime, config), updated all consumers, moved 11 test files, and fixed root tooling to cover workspaces. The work is architecturally sound and follows the existing `@ghui/keymap` pattern. The main concern is that it's a single large commit with no PR or verified CI. If rebasing onto current main, the delta should be manageable since the branch is based on the current main tip (0.7.1).
