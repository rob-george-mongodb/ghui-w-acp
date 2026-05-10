# Codebase Research: Core Module Extraction Candidates

## Research Question
Which non-UI modules under `src/` (outside `src/services/`) are UI-agnostic or mostly UI-agnostic, and could belong in an extracted shared/core package?

## Search Trail

| # | Search / Action | Files | Notes |
|---|----------------|-------|-------|
| 1 | `read src/` directory listing | 21 entries | Identified 12 non-service, non-UI top-level files |
| 2 | Read all top-level `.ts` files | 10 files | Assessed each for UI/framework coupling |
| 3 | `grep ^import src/keymap/*.ts` | 19 files | All import only `@ghui/keymap` — no React/opentui |
| 4 | `grep DiffView\|DiffWhitespaceMode src/ui/diff.ts` | 9 matches | Types used by `appCommands.ts` live in UI module |
| 5 | Read `src/ui/*.ts` (non-tsx) | 6 files | Some are pure logic, some coupled to `colors.ts` |

## Relevant Files

### Tier 1 — Fully UI-agnostic, zero framework imports

| # | File | Lines | Dependencies | Notes |
|---|------|-------|-------------|-------|
| 1 | `src/domain.ts` | 183 | `effect` (Schema only, L1) | Pure domain types & constants. Only framework dep is `Schema.Literals` for `DiffCommentSide` (L48). |
| 2 | `src/date.ts` | 18 | none | Pure date formatting utilities. Zero imports. |
| 3 | `src/errors.ts` | 10 | none | `errorMessage()` helper. Zero imports. |
| 4 | `src/commands.ts` | 91 | none | `AppCommand` type, fuzzy filter/sort. Zero imports. |
| 5 | `src/mergeActions.ts` | 151 | `./domain.js` (types only) | Merge action definitions, CLI arg builders, availability predicates. Pure logic. |
| 6 | `src/pullRequestCache.ts` | 19 | `./domain.js` (types only) | `mergeCachedDetails()` — pure data merge. |
| 7 | `src/pullRequestViews.ts` | 42 | `./domain.js` | View model types, URL parser, navigation helpers. Pure logic. |
| 8 | `src/pullRequestLoad.ts` | 10 | `./domain.js`, `./pullRequestViews.js` | Tiny interface definition. |
| 9 | `src/config.ts` | 27 | `effect`, `node:os`, `node:path` | Reads env vars, produces plain config object. No UI. |
| 10 | `src/observability.ts` | 45 | `effect` | OTLP layer setup. No UI. |
| 11 | `src/ui/commentEditor.ts` | 130 | none | Pure text-editor logic (cursor math, line splitting). Despite living in `ui/`, has zero UI imports. |
| 12 | `src/ui/singleLineInput.ts` | 26 | none | `deleteLastWord`, `printableKeyText`. Zero UI imports. |
| 13 | `src/ui/spinner.ts` | 4 | none | Frame constants only. |

### Tier 2 — Mostly UI-agnostic but has a coupling seam

| # | File | Coupling | Details |
|---|------|----------|---------|
| 14 | `src/appCommands.ts` (458 lines) | Imports `DiffView`, `DiffWhitespaceMode`, `DiffWrapMode` from `src/ui/diff.js` (L4) | The command builder itself is pure logic — it takes an actions interface and state flags, returns `AppCommand[]`. The coupling is only three type imports that could be relocated. |
| 15 | `src/themeConfig.ts` (62 lines) | Imports `ThemeId`, `ThemeTone`, helpers from `src/ui/colors.js` (L1) | Pure config normalization logic, but theme types live in a 1375-line UI color file. |
| 16 | `src/themeStore.ts` (102 lines) | Imports from `src/ui/colors.js` (L5) and `src/ui/diff.js` (L7) | Persistence layer (reads/writes `~/.config/ghui/config.json`). Uses `Bun.file`/`Bun.write` — Bun-specific. |
| 17 | `src/systemAppearance.ts` (48 lines) | Imports `ThemeTone` from `src/ui/colors.js` (L1) | OS appearance detection. Uses `Bun.spawn` — Bun-specific. Single type import from UI. |
| 18 | `src/ui/diff.ts` (704 lines) | Imports `parseColor`, `pathToFiletype`, `SyntaxStyle` from `@opentui/core` (L1); imports `colors` from `./colors.js` (L4) | ~650 lines of pure diff parsing logic mixed with opentui color lookups. The type definitions (`DiffView`, `DiffWrapMode`, etc.) and patch parsing are UI-agnostic; the rendering helpers are coupled. |
| 19 | `src/ui/inlineSegments.ts` (82 lines) | Imports `CommentSegment` from `./comments.js` (L1) — a `.tsx` file | Pure tokenizer logic coupled only by the segment type it returns. |

### Tier 3 — Tightly coupled, not candidates

| # | File | Why |
|---|------|-----|
| 20 | `src/keyboard/opentuiAdapter.ts` | Imports `@opentui/core`, `@opentui/react`, `react` (L1-5). Bridge code. |
| 21 | `src/keymap/*.ts` (19 files) | Import `@ghui/keymap` only — already extracted to `packages/keymap`. These define app-specific keymap contexts. |
| 22 | `src/App.tsx`, `src/index.tsx` | React entry points. |
| 23 | `src/standalone.ts` | CLI entry point, Bun-specific. |
| 24 | All `src/ui/*.tsx` files | React components. |

## Code Path Map

### Domain types flow

```
src/domain.ts  (types + constants)
  ← src/mergeActions.ts        (pure merge logic)
  ← src/pullRequestViews.ts    (view model helpers)
  ← src/pullRequestLoad.ts     (interface only)
  ← src/pullRequestCache.ts    (cache merge logic)
  ← src/appCommands.ts         (command builder)
  ← src/ui/diff.ts             (diff parsing + rendering)
  ← src/ui/pullRequests.ts     (PR display helpers)
```

### Theme types flow (the awkward seam)

```
src/ui/colors.ts  (1375 lines: ThemeId, ThemeTone, theme defs, color palette)
  ← src/themeConfig.ts         (config normalization — needs ThemeId, ThemeTone, filter/pair helpers)
  ← src/themeStore.ts          (persistence — needs ThemeId, isThemeId)
  ← src/systemAppearance.ts    (OS detection — needs ThemeTone only)
  ← src/ui/diff.ts             (diff rendering — needs colors palette)
```

### Package boundary suggestion

A natural `@ghui/core` package would include:
- `domain.ts` — types, constants
- `date.ts` — formatting
- `errors.ts` — error extraction
- `commands.ts` — command type + filtering
- `mergeActions.ts` — merge logic
- `pullRequestViews.ts` + `pullRequestLoad.ts` + `pullRequestCache.ts` — PR data layer
- `config.ts` — config resolution
- `commentEditor.ts`, `singleLineInput.ts` — text editing logic

**Seams to cut first:**
1. Extract `DiffView`, `DiffWrapMode`, `DiffWhitespaceMode` type definitions out of `src/ui/diff.ts` into `domain.ts` or a new `src/diffTypes.ts` — this unblocks `appCommands.ts`.
2. Extract `ThemeId`, `ThemeTone`, `isThemeId`, `filterThemeDefinitions`, `pairedThemeId`, `themeToneForThemeId` out of `src/ui/colors.ts` into a `themeTypes.ts` — this unblocks `themeConfig.ts`, `themeStore.ts`, `systemAppearance.ts`.
3. Split `src/ui/diff.ts` into parsing (UI-agnostic) vs rendering (opentui-coupled).

## Architectural Context

- **Existing extracted package**: `packages/keymap` (`@ghui/keymap`) — already split out with its own `package.json`, tests, README.
- **Runtime**: Bun-specific APIs used in `themeStore.ts` (L33: `Bun.file`, L40: `Bun.write`), `systemAppearance.ts` (L7: `Bun.spawn`), `standalone.ts`.
- **Effect library**: Used for config (`config.ts`), schema (`domain.ts`), persistence (`themeStore.ts`), observability (`observability.ts`). Would come along as a dependency.
- **No atom/signal/state coupling**: None of the Tier 1 files use jotai, zustand, signals, or any reactive state. State management is in `App.tsx`.
- **Related tests**: `test/` directory exists (not enumerated; file paths not inspected for this research).

## Summary

12-13 files under `src/` are fully UI-agnostic with zero React/opentui/framework imports and form a natural `@ghui/core` extraction target. The main blockers are two type-level seams: diff mode types living in `src/ui/diff.ts` and theme identity types buried in the 1375-line `src/ui/colors.ts`. Cutting those two seams (by relocating ~20 lines of type definitions) would cleanly separate domain/logic from rendering. The `packages/keymap` extraction provides a precedent for the package structure.
