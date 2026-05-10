# Codebase Research: Diff/Theme Extraction Seams

## Research Question
Where are the risky extraction seams around diff/theme logic that currently straddle UI and non-UI concerns, and what concrete cuts would enable package extraction?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `from ["'].*\/ui\/diff` | 5 | 3 non-UI consumers (themeStore, appCommands, App.tsx) + 2 test files |
| 2 | `from ["'].*\/ui\/colors` | 8 | 3 non-UI consumers (themeStore, themeConfig, systemAppearance) + index.tsx bootstrap |
| 3 | `from ["'].*\/colors` (within src/) | 18 | 10 UI-internal, 3 non-UI, rest are entry/dev |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/ui/diff.ts` | Mixed: pure diff parsing + render-coupled layout logic | L1-704 (entire file) |
| 2 | `src/ui/colors.ts` | Mixed: pure type defs + color math + mutable singleton + theme registry | L1-1375 (entire file) |
| 3 | `src/themeStore.ts` | Non-UI persistence; imports `ThemeId` from colors, `DiffWhitespaceMode` from diff | L5-7 |
| 4 | `src/themeConfig.ts` | Non-UI config normalization; imports 6 symbols from `ui/colors.js` | L1 |
| 5 | `src/systemAppearance.ts` | Non-UI OS detection; imports `ThemeTone` from `ui/colors.js` | L1 |
| 6 | `src/appCommands.ts` | Non-UI command definitions; imports `DiffView`, `DiffWhitespaceMode`, `DiffWrapMode` type-only | L4 |

## Analysis: `src/ui/diff.ts` — Pure vs Rendering

### Pure parsing/state logic (no UI dependency)
These functions have zero opentui imports and operate on strings/data only:

| Function | Lines | Notes |
|----------|-------|-------|
| `unquoteDiffPath` | L81 | String util |
| `readDiffPath` | L83-100 | String util |
| `parseDiffGitPaths` | L102-110 | String util |
| `patchFileName` | L112-125 | String util |
| `normalizeHunkLineCounts` | L131-160 | Patch text transform |
| `whitespaceComparableText` | L162 | String util |
| `linearWhitespaceEquivalentMatches` | L165-193 | LCS algorithm |
| `whitespaceEquivalentMatches` | L195-227 | LCS algorithm |
| `mergeWhitespaceEquivalentChanges` | L229-246 | Patch transform |
| `minimizeWhitespaceHunk` | L248-278 | Patch transform |
| `minimizeWhitespacePatch` | L280-299 | **Exported** patch transform |
| `minimizeWhitespaceDiffFiles` | L301-306 | **Exported** |
| `splitPatchFiles` | L308-324 | **Exported** core parser |
| `diffFileStats` | L388-407 | **Exported** stat counter |
| `diffFileStatsText` | L409-411 | **Exported** formatting |
| `diffCommentLocationKey` | L373 | Key builder |
| `diffCommentSideLabel` / `diffCommentLineLabel` / `diffCommentAnchorLabel` | L375-379 | Formatting |
| `nearestDiffCommentAnchorIndex` | L596-600 | Index lookup |
| `scrollTopForVisibleLine` | L602-607 | Scroll math (pure arithmetic, no UI) |
| `verticalDiffAnchor` / `diffAnchorOnSide` / `nearestDiffAnchorForLocation` | L553-594 | Navigation over anchors |
| `safeDiffFileIndex` | L328 | Bounds clamp |
| `pullRequestDiffKey` | L326 | Cache key |

### Pure types/schemas (extractable)
- `DiffView`, `DiffWrapMode`, `DiffWhitespaceMode`, `DiffCommentKind` — Schema literals (L6-16)
- `DiffFilePatch`, `DiffFileStats`, `DiffCommentAnchor`, `StackedDiffFilePatch`, `StackedDiffCommentAnchor`, `PullRequestDiffState` — interfaces/tagged enums (L18-58)

### Rendering-coupled logic
These depend on layout dimensions or opentui:

| Function | Lines | Coupling |
|----------|-------|----------|
| `createDiffSyntaxStyle` | L60-79 | Imports `parseColor`, `SyntaxStyle` from `@opentui/core`; reads mutable `colors` singleton |
| `estimatedWrappedLineCount` | L609-612 | Uses `Bun.stringWidth` (runtime-specific) |
| `patchLineNumberGutterWidth` | L614-647 | Pure math but conceptually render-layout |
| `diffContentWidth` | L383-386 | Combines gutter width with viewport width |
| `patchRenderableLineCount` | L649-703 | Needs `DiffView`, viewport `width` — layout calculation |
| `buildStackedDiffFiles` | L330-346 | Calls `patchRenderableLineCount` — layout |
| `getDiffCommentAnchors` | L413-536 | Computes `renderLine`/`colorLine` — render coordinates |
| `getStackedDiffCommentAnchors` | L538-551 | Wraps above with stacked offsets |
| `stackedDiffFileIndexAtLine` / `stackedDiffFileAtLine` | L348-364 | Operates on stacked layout data |

### Dependency on `colors` singleton
Only `createDiffSyntaxStyle` (L60-79) reads the mutable `colors` object. Everything else is pure.

## Analysis: `src/ui/colors.ts` — Non-UI Consumers

### Types consumed outside UI
- **`ThemeId`** — used by `themeStore.ts` (L5), `themeConfig.ts` (L1), `appCommands.ts` (indirectly via config), `App.tsx`
- **`ThemeTone`** — used by `systemAppearance.ts` (L1), `themeConfig.ts` (L1)
- **`ColorPalette`** — only used within UI components and `colors.ts` itself

### Functions consumed outside UI
- `isThemeId` — `themeStore.ts` (L5), `themeConfig.ts` (L1)
- `filterThemeDefinitions` — `themeConfig.ts` (L1)
- `pairedThemeId` — `themeConfig.ts` (L1)
- `themeToneForThemeId` — `themeConfig.ts` (L1)

### Mutable global state
`colors.ts` has a **mutable singleton** pattern:
- L1340: `let activeTheme = ...`
- L1342: `export const colors: ColorPalette = { ...ghuiColors }` — object is mutated via `Object.assign`
- L1364-1368: `setActiveTheme` mutates `colors` in place
- L1370-1375: `setSystemThemeColors` mutates both `systemColors` and `colors`

This mutable singleton is the riskiest seam — it's imported by 10+ UI files and `createDiffSyntaxStyle` in diff.ts.

## Recommended Seam Cuts

### Cut 1: Extract `src/diff-core.ts` (or a `diff` package)
Move all pure parsing, types, and schemas out of `src/ui/diff.ts`:

**What moves:**
- All types/schemas (L6-58)
- All unexported string utils (`unquoteDiffPath`, `readDiffPath`, `parseDiffGitPaths`, `patchFileName`) (L81-125)
- `hunkHeaderPattern` (L127)
- All whitespace minimization (L129-306)
- `splitPatchFiles` (L308-324)
- `diffFileStats`, `diffFileStatsText` (L388-411)
- `pullRequestDiffKey`, `safeDiffFileIndex` (L326-328)
- Comment key/label helpers (L373-379)
- Anchor navigation functions (L553-600)
- `scrollTopForVisibleLine` (L602-607)

**What stays in `src/ui/diff.ts`:**
- `createDiffSyntaxStyle` (opentui + colors dependency)
- `estimatedWrappedLineCount` (Bun.stringWidth)
- `patchLineNumberGutterWidth`, `diffContentWidth`, `patchRenderableLineCount`
- `buildStackedDiffFiles`, `getDiffCommentAnchors`, `getStackedDiffCommentAnchors`
- `stackedDiffFileIndexAtLine`, `stackedDiffFileAtLine`

**Risk:** Low. The pure functions have no shared mutable state. The only import from `@opentui/core` is `pathToFiletype` in `splitPatchFiles` (L1, L322) — this would need to be either inlined or accepted as a dependency.

### Cut 2: Extract `src/theme-types.ts`
Move type definitions and pure query functions out of `src/ui/colors.ts`:

**What moves:**
- `ThemeId` type (L1-29)
- `ThemeTone` type (L30)
- `ColorPalette` interface (L32-70)
- `ThemeDefinition` interface (L72-78)
- `themeDefinitions` array (L1294-1322) — pure data
- `isThemeId` (L1346)
- `themeToneForThemeId` (L1348)
- `oppositeThemeTone` (L1350)
- `pairedThemeId` (L1352-1355)
- `filterThemeDefinitions` (L1357-1362)
- `getThemeDefinition` (L1344)

**What stays in `src/ui/colors.ts`:**
- The mutable `colors` singleton + `setActiveTheme` + `setSystemThemeColors`
- Color math utilities (`mixHex`, `hexToRgb`, `rgbToHex`, `luminance`, etc.)
- `rowHoverBackground`, `lineNumberTextColor`
- `makeSystemColors` and all palette constants

**Risk:** Medium. `themeConfig.ts` and `themeStore.ts` currently reach into `ui/colors.js` purely for types and query functions — this cut eliminates that cross-layer dependency cleanly. However, `filterThemeDefinitions` depends on `themeDefinitions` which includes all palette data, so the palette constants must travel with the definitions array or `filterThemeDefinitions` must accept definitions as a parameter.

### Cut 3: Extract color math to `src/color-math.ts`
`mixHex`, `hexToRgb`, `rgbToHex`, `luminance`, `contrastText`, `grayscaleRamp`, `mutedTextColor`, `readableHex` are all pure functions with zero dependencies. They could form a standalone utility.

**Risk:** Very low. No shared state, no external deps.

## Architectural Context
- **Module:** `src/ui/` is the opentui rendering layer; `src/` root contains domain, config, persistence
- **Dependencies:** `@opentui/core` (rendering), `effect` (Schema, Data, Effect), `Bun` runtime APIs
- **Configuration:** Theme stored in `~/.config/ghui/config.json` via `themeStore.ts`
- **Related Tests:** `test/githubDiff.test.ts`, `test/diffStacking.test.ts`, `test/colors.test.ts`, `test/pullRequestsDisplay.test.ts`
- **Mutable global:** `colors` object in `colors.ts` is the primary shared mutable state — any extraction must decide whether consumers take a `ColorPalette` parameter or continue reading the singleton

## Summary

`src/ui/diff.ts` is roughly 60% pure parsing/algorithms and 40% render-layout code. The pure portion has a single external dependency (`pathToFiletype` from opentui). `src/ui/colors.ts` is a 1375-line file where ~70% is static palette data and pure type definitions consumed by non-UI modules (`themeConfig.ts`, `themeStore.ts`, `systemAppearance.ts`). The mutable `colors` singleton (L1340-1368) is the highest-risk seam because 10+ files read it at render time. The cleanest first cut is extracting diff types+parsing, followed by theme types+definitions, with color math as an optional third package.
