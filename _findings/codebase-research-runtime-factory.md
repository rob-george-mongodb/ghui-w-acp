# Codebase Research: Runtime Factory & Package Extraction Boundaries

## Research Question
What is the current bootstrap/runtime/layer creation flow, where are the module-level side effects, and what factory/adaptor boundaries would cleanly separate a "core" package from the TUI shell?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `src/index.tsx` | 1 | Top-level `await`, renderer creation, Bootstrap component |
| 2 | Read `src/App.tsx` L1-600 | 1 | Module-level runtime, atoms, layer assembly, side-effecting config |
| 3 | `grep "^export const config"` in `src/config.*` | 1 | `config.ts` – `Effect.runSync` at module scope |
| 4 | `grep setActiveTheme\|setSystemThemeColors` in `src/ui/colors.ts` | 1 | Mutable module-level color proxy |
| 5 | `grep "^export (const\|class)" src/services/*` | 6 files | Service classes with `.layer` / `.layerNoDeps` |
| 6 | Read `src/observability.ts` | 1 | Pure layer, no side effects |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/index.tsx` | Entrypoint: renderer, process signals, Bootstrap component | L57-65 (renderer), L85-121 (Bootstrap), L123-125 (mount) |
| 2 | `src/App.tsx` | **All** runtime/layer assembly and atom creation at module scope | L174-197 (side effects), L185-190 (runtime), L274-378 (atoms), L704+ (App component) |
| 3 | `src/config.ts` | `Effect.runSync` at module level → reads env vars eagerly | L23-27 |
| 4 | `src/ui/colors.ts` | Mutable global theme state (`setActiveTheme`) | L1364-1375 |
| 5 | `src/services/GitHubService.ts` | Service definition with `.layerNoDeps` | L581+ |
| 6 | `src/services/CacheService.ts` | Service + disabled/path layers | L365+ |
| 7 | `src/observability.ts` | Layer (clean, no side effects) | L22-44 |

## Code Path Map

### Entry Point: `src/index.tsx` (process starts here)

1. **L12** – Side effect: sets `process.env.OTUI_USE_ALTERNATE_SCREEN`.
2. **L57-65** – `await createCliRenderer(...)` – top-level await creates the terminal renderer with exit handler.
3. **L67-83** – `reloadSystemThemeColors` / SIGUSR2 handler registered on `process`.
4. **L85-121** – `Bootstrap` React component:
   - On mount, fires `setTimeout(0)` to defer heavy work.
   - Calls `addGhUiParsers()` (tree-sitter WASM registration).
   - **Dynamic imports** `@effect/atom-react` and `./App.js` in parallel with palette fetch.
   - Renders `<StartupLogo>` until both resolve, then `<RegistryProvider><App/></RegistryProvider>`.
5. **L123-125** – `process.stdout.write(FOCUS_REPORTING_ENABLE)` then `createRoot(renderer).render(<Bootstrap />)`.

### Entry Point: `src/App.tsx` module evaluation (runs on dynamic `import("./App.js")`)

**Module-scope side effects (all execute before `App` component ever renders):**

1. **L174** – `parseOptionalPositiveInt(process.env.GHUI_MOCK_PR_COUNT, null)` — reads env.
2. **L176-183** – Conditionally `await import("./services/MockGitHubService.js")` — top-level await, decides GitHub layer.
3. **L185-190** – `Atom.runtime(Layer.mergeAll(...))` — **creates the shared Effect runtime** with `GitHubService`, `CacheService`, `Clipboard`, `BrowserOpener`, `CommandRunner`, `Observability`. This is the app's DI root.
4. **L191-197** – `await Promise.all([loadStoredThemeConfig, loadStoredDiffWhitespaceMode, detectSystemAppearance()])` — async I/O at module scope, then calls `setActiveTheme(initialThemeId)` which **mutates** the global `colors` proxy in `ui/colors.ts`.
5. **L274-378** – ~30 `Atom.make(...)` / `githubRuntime.atom(...)` / `githubRuntime.fn(...)` calls — all at module scope, all captured in closure over `githubRuntime`.
6. **L469-533** – More `githubRuntime.fn<>()` atoms for every GitHub mutation (merge, close, comment, etc.).

### Mutable Global: `src/ui/colors.ts`

- `colors` is a mutable proxy object. `setActiveTheme(id)` (L1364) reassigns its properties.
- `setSystemThemeColors(terminalColors)` (L1370) patches system-derived palette values.
- Every UI component reads `colors.*` directly — there is no React context or atom for theme colors, just the mutable module singleton.

### Config: `src/config.ts`

- `config` is computed via `Effect.runSync` at module scope (L23). Reads `GHUI_PR_FETCH_LIMIT`, `GHUI_PR_PAGE_SIZE`, `GHUI_CACHE_PATH` from env/config.
- Used by `App.tsx` L175 and service layers.

## Architectural Context

- **Module**: Single-package monorepo (root `@kitlangton/ghui`), plus `packages/keymap` as internal package.
- **Dependencies**: `effect` (runtime/layers/atoms), `@opentui/core` + `@opentui/react` (TUI renderer), `@effect/atom-react` (atom-React bridge).
- **Configuration**: Env vars (`GHUI_MOCK_PR_COUNT`, `GHUI_PR_PAGE_SIZE`, `GHUI_CACHE_PATH`, `GHUI_OTLP_ENDPOINT`, etc.) read at module scope.
- **Related Tests**: `test/` directory exists (not inspected).

## Module-Level Side Effects Summary

These are the blockers for clean package extraction:

| Side Effect | Location | Why It Matters |
|---|---|---|
| `Effect.runSync(appConfig)` | `config.ts:23` | Eagerly reads env; importing config runs I/O |
| `await createCliRenderer(...)` | `index.tsx:57` | Binds process stdout; can't import without terminal |
| `process.env.OTUI_USE_ALTERNATE_SCREEN = "true"` | `index.tsx:12` | Mutates global env |
| `process.on("SIGUSR2", ...)` | `index.tsx:81` | Process-global handler |
| `await import("./services/MockGitHubService.js")` | `App.tsx:178` | Top-level await conditional on env |
| `Atom.runtime(Layer.mergeAll(...))` | `App.tsx:185` | Creates **the** runtime at import time |
| `await Promise.all([...theme I/O...])` | `App.tsx:191` | Async I/O at module scope |
| `setActiveTheme(initialThemeId)` | `App.tsx:197` | Mutates global mutable `colors` |
| 30+ `Atom.make(...)` at module scope | `App.tsx:274-378` | Atoms captured in closure over the single runtime |

## Recommended Factory/Adaptor Boundaries

### Proposed split: `@ghui/core` (new) vs `@kitlangton/ghui` (existing, becomes TUI shell)

**`@ghui/core` would own:**
1. **Service definitions** (`services/GitHubService.ts`, `CacheService.ts`, `Clipboard.ts`, `BrowserOpener.ts`, `CommandRunner.ts`, `Observability.ts`) — these are already clean Effect `Context.Service` classes with pure `.layer` constructors. No changes needed.
2. **Domain types** (`domain.ts`, `pullRequestViews.ts`, `mergeActions.ts`, `pullRequestCache.ts`, `errors.ts`, `date.ts`).
3. **Config** (`config.ts`) — but refactored: export `appConfig` as an `Effect<Config>` rather than eagerly `runSync`ing it. Consumers call `Effect.runSync` or provide it through a layer.

**`@ghui/core` must NOT own:**
- Anything in `ui/` (colors, modals, diff rendering, components).
- Atoms — these bind to a runtime and a UI framework.
- The renderer or bootstrap flow.

### Required refactoring in `App.tsx`:

The critical change is **a runtime factory function** replacing the module-scope runtime + atoms:

```typescript
// In @ghui/core:
export const makeAppLayer = (options: {
  mock?: { prCount: number; repoCount: number }
  cachePath: string | null
}) => Layer.mergeAll(
  options.mock
    ? MockGitHubService.layer(options.mock)
    : GitHubService.layerNoDeps,
  options.mock
    ? CacheService.disabledLayer
    : CacheService.layerFromPath(options.cachePath),
  Clipboard.layerNoDeps,
  BrowserOpener.layerNoDeps,
).pipe(
  Layer.provide(CommandRunner.layer),
  Layer.provideMerge(Observability.layer),
)

// In TUI shell (App.tsx):
export const createAppRuntime = (layer: Layer) => Atom.runtime(layer)
```

Then the ~30 atoms move into a factory function `createAppAtoms(runtime)` that returns them as a record, eliminating module-scope side effects entirely. The `App` component receives the atom record via props or React context.

### Adaptor boundary for non-TUI consumers:

A headless/CI consumer of `@ghui/core` would:
1. Import `makeAppLayer` + service classes.
2. Build an `Effect.Runtime` directly (no atoms, no `@opentui`).
3. Call service methods via `Effect.runPromise`.

No UI framework dependency leaks into core.

### Migration order:
1. Move service definitions + domain types into `@ghui/core` (zero behavior change).
2. Refactor `config.ts` to export the `Config` effect, not the eagerly-resolved value.
3. Extract `makeAppLayer` factory from `App.tsx` L176-190 into core.
4. Wrap the 30+ atoms in `App.tsx` L274-533 into a `createAppAtoms(runtime)` factory in the TUI shell.
5. Convert `colors` from mutable global to a theme context/atom.
