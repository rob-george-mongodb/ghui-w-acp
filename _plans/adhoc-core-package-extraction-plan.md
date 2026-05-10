# Core package extraction plan

## Status

Ready for human signoff.

## Problem Summary

The repo already has a large non-UI core hidden inside the TUI package: domain types, queue/view helpers, command models, Effect services, GitHub/cache integrations, theme/config persistence, and diff/search algorithms live alongside React/OpenTUI entrypoints. Today the published TUI package owns all of that code, so the reusable logic is hard to consume or evolve independently.

The goal of this effort is to extract the UI-agnostic logic into a new workspace package, then have the existing TUI consume that package without changing user-visible behavior. For this plan, “UI-agnostic” means “not coupled to React/OpenTUI rendering or TUI component files”; it does **not** require making the extracted package runtime-agnostic on day one. Bun-based services can move if they are not TUI-specific.

The plan below assumes we create a private internal workspace package first (`packages/core`, likely named `@ghui/core`) and keep separate npm publication out of scope for the first pass. That matches the repo’s current workspace and packaging model and minimizes release risk.

## Current Code Context

### Workspace, packaging, and release constraints

- The root repo is already a Bun workspace monorepo: `package.json` declares workspaces for `.` and `packages/*` (`package.json:57-60`).
- There is already one extracted internal package, `@ghui/keymap`, which is private, exports raw TypeScript, and has its own package-local `test` and `typecheck` scripts (`packages/keymap/package.json:1-18`, `packages/keymap/tsconfig.json:1-19`).
- The publish pipeline builds a synthetic npm package for `@kitlangton/ghui` that only contains the launcher plus optional binary packages; it does not publish workspace source packages (`dev/build-npm-packages.ts:81-107`).
- `dev/package-smoke.ts` explicitly asserts that private workspace packages do not leak into the published manifest (`dev/package-smoke.ts:41-45`).
- Current root tooling does **not** cover `packages/*`: root scripts only target `src/`, `test/`, and `dev/` (`package.json:37-55`), the root TS config only includes `src/**/*.ts(x)` and `dev/**/*.ts(x)` (`tsconfig.json:21`), and CI just runs those root scripts (`.github/workflows/ci.yml:24-34`).
- Bun compiles reachable workspace imports directly into the standalone binary, so extracting code into `packages/core` changes ownership and test boundaries, not the shipped binary shape (`dev/build-cli.ts:1-7`, `dev/build-npm-packages.ts:68`, `src/standalone.ts:55`).

### Clear extraction candidates already living outside the UI layer

The following modules are already cleanly separated from React/OpenTUI rendering and can move with little or no API change:

- Domain and queue/view helpers: `src/domain.ts:1-183`, `src/pullRequestViews.ts:1-42`, `src/pullRequestLoad.ts:1-10`, `src/pullRequestCache.ts:1-19`, `src/mergeActions.ts:1-151`, `src/date.ts:1-18`, `src/errors.ts:1-10`, `src/commands.ts:1-91`.
- App command modelling is also UI-toolkit agnostic, but it currently depends on diff-mode types imported from `src/ui/diff.ts` (`src/appCommands.ts:1-75`).
- Observability is a pure layer with no UI dependency (`src/observability.ts:1-45`).
- The service layer is already expressed as Effect services: `CommandRunner` (`src/services/CommandRunner.ts:32-99`), `GitHubService` (`src/services/GitHubService.ts:581-968`), `CacheService` (`src/services/CacheService.ts:365-413`), `BrowserOpener` (`src/services/BrowserOpener.ts:13-39`), `Clipboard` (`src/services/Clipboard.ts:18-47`), and `MockGitHubService` (`src/services/MockGitHubService.ts:18-283`).

### Modules that are logically reusable but currently cut across the UI boundary

- `src/themeConfig.ts` is pure config logic, but it imports theme identities/helpers from `src/ui/colors.js` (`src/themeConfig.ts:1-24`).
- `src/themeStore.ts` is config persistence logic, but it imports `ThemeId` from `src/ui/colors.js` and `DiffWhitespaceMode` from `src/ui/diff.js` (`src/themeStore.ts:5-7`) and uses Bun file I/O (`src/themeStore.ts:32-40`).
- `src/systemAppearance.ts` is OS appearance detection, but it imports `ThemeTone` from `src/ui/colors.js` (`src/systemAppearance.ts:1-3`) and uses `Bun.spawn` (`src/systemAppearance.ts:5-13`).
- `src/ui/diff.ts` mixes extractable diff types/parsers (`src/ui/diff.ts:6-58`, `src/ui/diff.ts:81-411`, `src/ui/diff.ts:553-607`) with OpenTUI/style/layout logic (`src/ui/diff.ts:60-79`, `src/ui/diff.ts:609-703`).
- `src/ui/colors.ts` mixes theme identity/metadata (`src/ui/colors.ts:1-30`, `src/ui/colors.ts:1294-1362`) with the mutable rendering palette singleton used directly by the TUI (`src/ui/colors.ts:1340-1375`).
- Theme metadata is used outside rendering, but the full palette-bearing `themeDefinitions` list is still used by the TUI for notices and theme-picker swatches (`src/App.tsx:2524-2525`, `src/ui/modals.tsx:1295-1373`), so the split must keep palette application in the TUI shell.
- `src/ui/modals.tsx` contains pure search helpers inside a component file: `filterLabels` (`src/ui/modals.tsx:143-147`) and `filterChangedFiles` (`src/ui/modals.tsx:294-307`).
- `src/ui/commentEditor.ts` and `src/ui/singleLineInput.ts` are pure editing/input helpers despite their location (`src/ui/commentEditor.ts:1-130`, `src/ui/singleLineInput.ts:1-26`).

### Current TUI integration surface

- `src/App.tsx` is the main consumer of all of the non-UI logic above. It reads config at module scope, assembles the runtime layer, hydrates theme state, and defines the app atom graph in the same file (`src/App.tsx:174-197`, `src/App.tsx:274-338`, `src/App.tsx:469-532`).
- `src/index.tsx` is purely TUI bootstrap: renderer creation, signal wiring, dynamic `App` import, and root render (`src/index.tsx:57-125`).
- The root CLI entry remains `src/standalone.ts`, which just handles CLI arguments and then imports `src/index.js` (`src/standalone.ts:1-55`).

### Current test surface

- Most root tests already exercise pure logic or service behavior rather than the TUI. Examples include cache integration (`test/cacheService.test.ts:1-223`), GitHub diff assembly (`test/githubDiff.test.ts:1-57`), app command logic (`test/appCommands.test.ts:1-199`), theme config (`test/themeConfig.test.ts:1-52`), and system appearance parsing (`test/systemAppearance.test.ts:1-22`).
- Only `test/scrolling.test.tsx` renders the actual TUI; it dynamically imports `App` and exercises scroll behavior through the OpenTUI test renderer (`test/scrolling.test.tsx:35-79`).

## Proposed Changes

### 1. Prepare workspace tooling and scaffold a private core package

Create `packages/core` as a private workspace package, following the same pattern as `packages/keymap`, and fix the existing workspace-coverage gap before relying on it:

- `packages/core/package.json` with raw TS exports and package-local `test` / `typecheck` scripts.
- `packages/core/tsconfig.json` mirroring the keymap package’s standalone setup.
- Add `@ghui/core` to the root workspace dependencies (likely `devDependencies`, matching `@ghui/keymap` in `package.json:71-77`).
- Add root umbrella scripts and CI coverage for **all workspace packages**, at minimum `packages/keymap` and `packages/core`, because current CI never runs package-local `test` / `typecheck` scripts for workspace packages (`packages/keymap/package.json:11-14`, `.github/workflows/ci.yml:24-34`).
- Extend root formatting/lint coverage to include workspace source, ideally `packages/*/src`, so the new package does not repeat the current tooling blind spot (`package.json:48-55`).
- Keep package-local TS configs for workspace packages; do **not** broaden the root `tsconfig.json` include to cover `packages/core` (`tsconfig.json:21`).
- Extend package smoke so the published `@kitlangton/ghui` artifact also asserts it does not depend on `@ghui/core`, the same way it already asserts that for `@ghui/keymap` (`dev/package-smoke.ts:41-45`).

This keeps the release flow stable because the repo currently publishes only the launcher package plus platform binaries, while workspace packages are compile-time inputs to the binary rather than separately published artifacts (`dev/build-npm-packages.ts:68`, `dev/build-npm-packages.ts:81-107`).

### 2. Move the obviously reusable modules first

Move the files that already have the right boundary into `packages/core/src/` with minimal semantic change:

- `domain.ts`, `date.ts`, `errors.ts`, `commands.ts`
- `pullRequestViews.ts`, `pullRequestLoad.ts`, `pullRequestCache.ts`
- `mergeActions.ts`
- `observability.ts`
- `services/CommandRunner.ts`, `GitHubService.ts`, `CacheService.ts`, `BrowserOpener.ts`, `Clipboard.ts`, `MockGitHubService.ts`

Three notes for this move:

1. `CommandRunner` and `CacheService` are Bun-specific today (`src/services/CommandRunner.ts:27-30`, `src/services/CacheService.ts:1-4`), but they are still non-UI and can live in the core package for v1.
2. `GitHubService` currently imports the root `config` singleton to get `prFetchLimit` (`src/services/GitHubService.ts:683-684`), and it also depends on `mergeActionCliArgs` from `mergeActions` (`src/services/GitHubService.ts:21`). Move `GitHubService` and `mergeActions` together, with the config cleanup landing before or during that move.
3. `appCommands.ts` should move only **after** Step 3b lands the diff-mode types in core, because its only remaining UI coupling is the type import from `src/ui/diff.ts` (`src/appCommands.ts:4`).

### 3. Cut the mixed modules at the actual seam, not the directory seam

Do **not** move `src/ui/*` wholesale. Instead, split the files that currently mix reusable logic with TUI rendering concerns.

#### 3a. Extract a core theme registry module

Create a new core theme metadata module that owns:

- `ThemeId`
- `ThemeTone`
- a metadata catalog used for selection/search (id, name, description, tone)
- `isThemeId`, `themeToneForThemeId`, `pairedThemeId`, `getThemeMetadata`, and theme filtering helpers over that metadata catalog

These items are currently mixed into `src/ui/colors.ts` (`src/ui/colors.ts:1-30`, `src/ui/colors.ts:1294-1362`) even though they are consumed by non-UI modules like `themeConfig`, `themeStore`, and `systemAppearance` (`src/themeConfig.ts:1-24`, `src/themeStore.ts:5-7`, `src/systemAppearance.ts:1-3`).

Keep the actual `ColorPalette` data, palette constants, `colors` singleton, `setActiveTheme`, and `setSystemThemeColors` in the TUI package because they are render-facing mutable UI state (`src/ui/colors.ts:1340-1375`). The TUI theme picker should join core metadata with TUI palette lookups when it needs swatches (`src/ui/modals.tsx:1295-1373`), rather than moving the full palette-bearing `themeDefinitions` array into core.

After this split, move `themeConfig.ts`, then move `themeStore.ts` and `systemAppearance.ts` once their type imports point at the new core theme module.

#### 3b. Extract a core diff model/parser module

Create a core diff module for:

- `DiffView`, `DiffWrapMode`, `DiffWhitespaceMode`
- patch splitting / whitespace normalization
- diff stats
- diff anchor/navigation helpers
- `pullRequestDiffKey`

These are currently mixed into `src/ui/diff.ts` alongside OpenTUI syntax-color and layout logic (`src/ui/diff.ts:6-58`, `src/ui/diff.ts:81-411`, `src/ui/diff.ts:553-607` vs. `src/ui/diff.ts:60-79`, `src/ui/diff.ts:609-703`).

Keep render/layout-specific helpers in the TUI package, especially anything that depends on syntax styling, viewport width, or `Bun.stringWidth` for TUI layout (`src/ui/diff.ts:60-79`, `src/ui/diff.ts:609-703`).

Make one concrete API change during the split: keep `DiffFilePatch.filetype` as plain `string | undefined` (`src/ui/diff.ts:18-22`), but change `splitPatchFiles` so it no longer imports `pathToFiletype` from `@opentui/core` (`src/ui/diff.ts:1`, `src/ui/diff.ts:308-323`). Instead, core should accept an optional `resolveFiletype(name)` callback (defaulting to `undefined`) and the TUI should pass `pathToFiletype` when it wants syntax highlighting. Once that lands, move `appCommands.ts` and the `DiffWhitespaceMode` consumer in `themeStore.ts` onto the core diff module.

#### 3c. Extract pure search/editor helpers from component files

Move the following into core utility modules:

- `filterLabels` and `filterChangedFiles` from `src/ui/modals.tsx:143-147` and `src/ui/modals.tsx:294-307`
- `commentEditor` primitives from `src/ui/commentEditor.ts:1-130`
- single-line input helpers from `src/ui/singleLineInput.ts:1-26`

This keeps the new package focused on reusable logic rather than file layout accidents.

### 4. Replace the config singleton with explicit config resolution

The extracted package should not rely on `Effect.runSync` happening at import time. Today `src/config.ts` eagerly resolves config and exports a singleton (`src/config.ts:17-27`), and both `App.tsx` and `GitHubService.ts` import it directly (`src/App.tsx:175-183`, `src/services/GitHubService.ts:683-684`).

Plan:

- Replace `config` with an explicit `AppConfig` type plus a `resolveAppConfig()` helper (or equivalent effectful loader).
- Thread `prFetchLimit`, `prPageSize`, and `cachePath` into the TUI bootstrap instead of importing a global singleton from inside core services.
- Update `GitHubService` to accept `prFetchLimit` via constructor/layer input or a tiny config service rather than importing `config` directly.

This keeps the core package import-safe and makes the package boundary explicit.

### 5. Export one stable runtime entrypoint and one curated package surface from core

In addition to moving files, add a curated `packages/core/src/index.ts` barrel so the TUI shell imports from a stable surface instead of deep package paths. For v1, that barrel should re-export the moved domain/helpers, service tags, diff/theme primitives, and one small layer-composition helper (name TBD, e.g. `makeCoreLayer`) that assembles:

- `GitHubService` or `MockGitHubService`
- `CacheService`
- `Clipboard`
- `BrowserOpener`
- `CommandRunner`
- `Observability`

This logic is currently composed inline in `src/App.tsx:176-190`. Moving the service-assembly helper into core gives the TUI a stable package API without forcing a full `App.tsx`/atom rewrite in the same pass.

Important scoping choice: the root TUI should continue to own `App.tsx`, the atom graph, `index.tsx`, `standalone.ts`, React/OpenTUI components, keymaps, and mutable palette state. A full `createAppAtoms(runtime)` refactor is a follow-up only if the implementation uncovers import-cycle or testability pain.

### 6. Update the TUI to consume `@ghui/core`

After the moves/splits above:

- Change `App.tsx`, `index.tsx`, dev tooling, and remaining root tests to import reusable logic from `@ghui/core` instead of local `src/*` paths.
- Leave only TUI-specific files in the root package: entrypoints, React/OpenTUI components, keyboard adapters, mutable palette state, and render/layout helpers.
- Keep the existing user behavior and command surface unchanged; this is a package-boundary refactor, not a redesign.

### 7. Move tests with the code they validate, and make workspace coverage mandatory

Move or re-home pure tests so they validate the new public boundary of `@ghui/core`. Strong candidates:

- `test/domain.test.ts`
- `test/errors.test.ts`
- `test/mergeActions.test.ts`
- `test/pullRequestCache.test.ts`
- `test/themeConfig.test.ts`
- `test/systemAppearance.test.ts`
- `test/cacheService.test.ts`
- `test/githubServiceComments.test.ts`
- `test/githubDiff.test.ts`
- `test/appCommands.test.ts`
- `test/filterLabels.test.ts`

Keep root TUI rendering tests such as `test/scrolling.test.tsx` in the TUI package.

Because the current root scripts and TS config ignore `packages/*` (`package.json:37-55`, `tsconfig.json:21`, `.github/workflows/ci.yml:24-34`), workspace coverage is a **blocking prerequisite**, not a nice-to-have. The implementation should:

- keep package-local `test` and `typecheck` scripts in `packages/core`
- add root CI steps (or root umbrella scripts) that run checks for root, `packages/keymap`, and `packages/core`
- extend root format/lint coverage to include workspace source, ideally `packages/*/src`
- leave the root TS config scoped to root source and use package-local TS configs for workspace typechecks

## Verification Plan

1. **Package boundary verification**
   - `packages/core` builds as a workspace package with its own `typecheck` and `test` scripts.
   - The root TUI imports extracted logic from `@ghui/core`, not from old local file paths.

2. **Core package tests**
   - Run the moved pure/service tests through `packages/core`.
   - Ensure cache tests still pass against a temp SQLite DB and GitHub service tests still pass with a fake `CommandRunner` (`test/cacheService.test.ts:1-223`, `test/githubDiff.test.ts:1-57`).

3. **Root TUI tests**
   - Keep and rerun the TUI rendering/integration tests, especially `test/scrolling.test.tsx:35-79`, to verify that the existing shell still works when consuming the package.

4. **Repo tooling / CI verification**
   - Run formatting, lint, typecheck, and test coverage for root plus all workspace packages, at minimum `packages/keymap` and `packages/core`.
   - Rerun `bun run package:smoke` and extend its manifest assertions so the published artifact still excludes private workspace packages (`dev/package-smoke.ts:41-45`).

5. **Release-path verification**
   - Confirm `dev/build-npm-packages.ts` output is unchanged from a publishing standpoint: the root package remains the published launcher, and `@ghui/core` does not become a runtime npm dependency (`dev/build-npm-packages.ts:81-107`).

## Risks / Open Questions

1. **Internal package or public package?**
   - This plan assumes private/internal first because the current publish pipeline only knows how to ship `@kitlangton/ghui` and platform binaries (`dev/build-npm-packages.ts:81-107`). If a separately published `@ghui/core` is desired, that needs additional build, changeset, and release-workflow work.

2. **Should theme persistence and system appearance live in core in v1?**
   - They are UI-agnostic but Bun-specific (`src/themeStore.ts:32-40`, `src/systemAppearance.ts:5-13`). Lean: yes, move them after extracting theme and diff types so the TUI shell only owns rendering concerns.

3. **Do we need a deeper App/runtime factory refactor now?**
   - `App.tsx` still does substantial module-scope setup (`src/App.tsx:174-197`, `src/App.tsx:274-338`). Lean: no full atom-factory rewrite in this pass; add only a small core layer helper and keep the TUI shell otherwise intact.

4. **How much of the pure logic under `src/ui/` must move in the first pass?**
   - `commentEditor`, `singleLineInput`, `filterLabels`, and `filterChangedFiles` are good fits, but they are not blockers for the main service/domain extraction. Lean: move them if the seam cuts are already open; otherwise avoid ballooning the change.

5. **Should the core package stay on a single top-level barrel or grow subpath exports immediately?**
   - Lean: one curated barrel for v1 because the package is internal-first. Revisit subpath exports only if the TUI shell starts depending on too much surface area.

## Relevant Files / Research References

### Key code references

- `package.json:37-60`, `package.json:71-77`
- `packages/keymap/package.json:1-18`
- `packages/keymap/tsconfig.json:1-19`
- `tsconfig.json:1-22`
- `.github/workflows/ci.yml:24-34`
- `dev/build-cli.ts:1-7`
- `dev/build-npm-packages.ts:81-107`
- `dev/build-npm-packages.ts:68`
- `dev/package-smoke.ts:32-75`
- `src/App.tsx:174-197`, `src/App.tsx:274-338`, `src/App.tsx:469-532`
- `src/App.tsx:2524-2525`
- `src/index.tsx:57-125`
- `src/config.ts:17-27`
- `src/domain.ts:1-183`
- `src/pullRequestViews.ts:1-42`
- `src/pullRequestLoad.ts:1-10`
- `src/pullRequestCache.ts:1-19`
- `src/mergeActions.ts:1-151`
- `src/commands.ts:1-91`
- `src/appCommands.ts:1-75`
- `src/observability.ts:1-45`
- `src/services/CommandRunner.ts:32-99`
- `src/services/GitHubService.ts:581-968`
- `src/services/CacheService.ts:365-413`
- `src/services/BrowserOpener.ts:13-39`
- `src/services/Clipboard.ts:18-47`
- `src/services/MockGitHubService.ts:18-283`
- `src/themeConfig.ts:1-24`
- `src/themeStore.ts:5-7`, `src/themeStore.ts:32-40`
- `src/systemAppearance.ts:1-13`
- `src/ui/colors.ts:1-30`, `src/ui/colors.ts:1294-1375`
- `src/ui/diff.ts:18-22`
- `src/ui/diff.ts:6-79`, `src/ui/diff.ts:81-411`, `src/ui/diff.ts:553-703`
- `src/ui/modals.tsx:143-147`, `src/ui/modals.tsx:294-307`
- `src/ui/modals.tsx:1295-1373`
- `src/ui/commentEditor.ts:1-130`
- `src/ui/singleLineInput.ts:1-26`
- `test/cacheService.test.ts:1-223`
- `test/githubDiff.test.ts:1-57`
- `test/scrolling.test.tsx:35-79`

### Research artifacts

- `_findings/codebase-research-workspace-packaging.md`
- `_findings/codebase-research-services-boundary.md`
- `_findings/codebase-research-core-modules.md`
- `_findings/codebase-research-tests-and-wiring.md`
- `_findings/codebase-research-diff-theme-seams.md`
- `_findings/codebase-research-runtime-factory.md`
