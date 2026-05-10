# Codebase Research: Services Boundary for Core Package Extraction

## Research Question
What code in `src/services/` and adjacent non-UI abstractions could move into a reusable core package, and what dependencies block direct extraction?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `src/services/` directory listing | 6 files | All service files identified |
| 2 | `GitHubService\|CacheService\|CommandRunner\|BrowserOpener\|Clipboard` across `src/` | 121 matches | Primary consumer is `App.tsx` |
| 3 | Read `src/domain.ts`, `src/config.ts`, `src/pullRequestCache.ts`, `src/pullRequestViews.ts`, `src/pullRequestLoad.ts`, `src/mergeActions.ts` | — | Adjacent pure-logic modules |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/services/CommandRunner.ts` | Process spawning abstraction; **only Bun-coupled file** | L29 (`Bun.readableStreamToText`), L49 (`Bun.spawn`) |
| 2 | `src/services/GitHubService.ts` | Full GitHub API client (GraphQL + REST via `gh` CLI) | L581-L609 (service interface), L610-L967 (layer implementation) |
| 3 | `src/services/CacheService.ts` | SQLite-backed PR cache | L3 (`@effect/sql-sqlite-bun` import), L394 (`SqliteClient.layer`) |
| 4 | `src/services/BrowserOpener.ts` | Opens URLs/PRs in browser | L8 (`process.platform`), L27 (delegates to `gh pr view --web`) |
| 5 | `src/services/Clipboard.ts` | Platform clipboard copy | L9-L13 (`process.platform`, `process.env.WAYLAND_DISPLAY`) |
| 6 | `src/services/MockGitHubService.ts` | Test/demo `GitHubService` layer | L191 (provides `GitHubService` tag) |
| 7 | `src/domain.ts` | All shared domain types (`PullRequestItem`, etc.) | L1-L183 — zero UI deps |
| 8 | `src/config.ts` | Reads env vars into static config object | L23 (`Effect.runSync`) — eagerly evaluated at import |
| 9 | `src/pullRequestCache.ts` | Pure merge-detail logic | L1-L19 — depends only on `domain.ts` |
| 10 | `src/pullRequestViews.ts` | View discriminator helpers | L1-L42 — depends only on `domain.ts` |
| 11 | `src/pullRequestLoad.ts` | `PullRequestLoad` interface | L1-L10 — depends on `domain.ts` + `pullRequestViews.ts` |
| 12 | `src/mergeActions.ts` | Merge-action CLI arg mapping + availability rules | L1-L151 — depends only on `domain.ts` |
| 13 | `src/App.tsx` | Wires all layers together; sole consumer of services | L49-L53 (imports), L178-L187 (layer composition) |

## Code Path Map

### Dependency graph (services only)

```
CommandRunner  (Bun.spawn)
  ├─▶ GitHubService.layerNoDeps   (gh CLI calls)
  ├─▶ BrowserOpener.layerNoDeps   (open / xdg-open / gh pr view --web)
  └─▶ Clipboard.layerNoDeps       (pbcopy / wl-copy / xclip)

CacheService.layerSqliteFile      (@effect/sql-sqlite-bun)
  └─▶ SqliteClient + SqliteMigrator

MockGitHubService.layer            (pure Effect.succeed, no deps)
```

All five services are consumed exclusively in `src/App.tsx` (L49-L53, L178-L187) via Effect `Layer` composition. No service is imported by UI components directly; the app creates a `githubRuntime` atom and UI hooks call through that.

### GitHubService internals

`GitHubService.layerNoDeps` (L610-L965) depends on:
1. `CommandRunner` — yields `command` at L613
2. `config.prFetchLimit` — imported statically at L683 from `src/config.ts`
3. `domain.ts` types + `pullRequestQueueSearchQualifier` (L5-L20)
4. `mergeActions.mergeActionCliArgs` (L21)

The entire GitHub API surface is built on `gh` CLI commands — both `gh api graphql` for GraphQL and `gh api` REST endpoints, plus `gh pr`/`gh repo` porcelain commands.

### CacheService internals

`CacheService.layerSqliteFile` (L394-L409) depends on:
1. `@effect/sql-sqlite-bun` — **Bun-specific** SQLite driver (L3)
2. `node:fs/promises` `mkdir` (L1)
3. `domain.ts` types
4. `pullRequestCache.mergeCachedDetails` (L9)
5. `pullRequestViews.viewCacheKey` (L11)
6. `pullRequestLoad.PullRequestLoad` type (L11)

## Blocking Dependencies for Extraction

### Hard blockers (runtime-specific)

| Dependency | File | Lines | Impact |
|------------|------|-------|--------|
| `Bun.spawn` / `Bun.readableStreamToText` | `CommandRunner.ts` | L29, L49 | Core process execution is Bun-only |
| `@effect/sql-sqlite-bun` / `SqliteClient` | `CacheService.ts` | L3 | Cache storage is Bun-only |

### Soft blockers (easily abstracted)

| Dependency | File | Lines | Impact |
|------------|------|-------|--------|
| `process.platform` | `BrowserOpener.ts`, `Clipboard.ts` | L8, L9 | Platform detection — trivially injectable |
| `process.env` | `config.ts`, `Clipboard.ts` | L9-L13, L12 | Env var reads — should become config injection |
| `config` static import | `GitHubService.ts` | L683 | `config.prFetchLimit` baked in at import time |

## Likely Package Seams

### Core package candidates (zero runtime coupling after `CommandRunner` is injected)

1. **`domain.ts`** — all types, zero deps. Moves as-is.
2. **`pullRequestCache.ts`** — pure function, depends only on `domain.ts`.
3. **`pullRequestViews.ts`** — pure helpers, depends only on `domain.ts`.
4. **`pullRequestLoad.ts`** — interface only, depends on `domain.ts` + `pullRequestViews.ts`.
5. **`mergeActions.ts`** — pure logic + CLI arg mapping, depends only on `domain.ts`.
6. **`GitHubService` interface** (L581-L608) — the Effect `Context.Service` type definition is runtime-agnostic. The _implementation_ (L610-L965) depends on `CommandRunner` which is the only runtime seam.
7. **`CacheService` interface** (L365-L373) — same pattern; the interface is runtime-agnostic, the SQLite implementation is Bun-specific.
8. **`BrowserOpener` interface** (L13-L18) and **`Clipboard` interface** (L18-L22) — tiny, runtime-agnostic service tags.

### App-specific adapters (stay in the app or become separate adapter packages)

1. **`CommandRunner.layer`** — Bun implementation of process spawning. A Node.js adapter would use `child_process`. This is the single chokepoint: every service that talks to `gh` goes through it.
2. **`CacheService.layerSqliteFile`** — Bun SQLite adapter. A Node.js adapter would use `better-sqlite3` or `@effect/sql-sqlite-node`.
3. **`MockGitHubService`** — test fixture; could live in a test-utils companion package.
4. **`config.ts`** — eagerly evaluates env vars via `Effect.runSync` (L23). Should be refactored to a `Layer`/`Config` that consumers provide, rather than a static module-level singleton.

### Recommended extraction boundary

```
@ghui/core
  ├── domain.ts              (types)
  ├── pullRequestCache.ts    (pure logic)
  ├── pullRequestViews.ts    (pure logic)
  ├── pullRequestLoad.ts     (interface)
  ├── mergeActions.ts        (pure logic)
  ├── services/
  │   ├── GitHubService.ts   (interface + implementation, requires CommandRunner)
  │   ├── CacheService.ts    (interface only; implementation needs runtime adapter)
  │   ├── BrowserOpener.ts   (interface only)
  │   ├── Clipboard.ts       (interface only)
  │   └── CommandRunner.ts   (interface only — run/runSchema contract)
  └── config.ts              (refactored to Config effect, not static)

@ghui/adapter-bun
  ├── CommandRunner.layer    (Bun.spawn)
  ├── CacheService.layerSqliteFile  (@effect/sql-sqlite-bun)
  └── platform helpers       (process.platform sniffing)
```

The key insight is that `GitHubService.layerNoDeps` already cleanly separates from `CommandRunner.layer` (L967). The `layerNoDeps` pattern is used consistently across `GitHubService`, `BrowserOpener`, and `Clipboard` — this was clearly designed with this split in mind.

## Architectural Context

- **Framework**: Effect (Context.Service, Layer, Schema) throughout
- **Runtime**: Bun — only surfaces in `CommandRunner.ts` (L29, L49) and `CacheService.ts` (L3 `@effect/sql-sqlite-bun`)
- **External CLI dependency**: All GitHub operations shell out to `gh` CLI, not the Octokit SDK
- **Config**: `src/config.ts` uses `Effect.runSync` at module scope (L23) — a static singleton that would need refactoring to become injectable
- **Related tests**: not searched (out of scope)

## Summary

The services layer is well-factored for extraction. Every service already uses the `layerNoDeps` pattern, cleanly separating the service interface + logic from its runtime adapter. The two hard Bun dependencies are isolated to `CommandRunner.layer` (process spawning) and `CacheService.layerSqliteFile` (SQLite driver). The domain types, pure logic modules (`pullRequestCache`, `pullRequestViews`, `mergeActions`), and service _interfaces_ can move to a core package unchanged. The main refactoring needed is converting `config.ts` from a static `Effect.runSync` singleton (L23) into an injectable `Config`/`Layer` so that `GitHubService` doesn't reach for `config.prFetchLimit` at L683 via a module-level import.
