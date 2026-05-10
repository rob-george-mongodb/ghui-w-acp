# Codebase Research: AppConfig Model and Updated-Since Window

## Research Question
How is AppConfig defined/resolved, how do values flow into GitHubService and App.tsx, is there an existing config-file surface, and where is the best integration point for a static default `updated-since` window for PR queries?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `AppConfig` in `*.ts` | 31 matches | Core definition in `config.ts`, consumed in `runtime.ts`, `App.tsx`, `GitHubService.ts`, tests |
| 2 | `GitHubService` in `*.ts` | 65 matches | Service definition + tests |
| 3 | `GITHUB_TOKEN\|GH_TOKEN\|env\.` in `*.ts` | 11 matches | Env vars: `GHUI_CONFIG_DIR`, `GHUI_CACHE_PATH`, `XDG_*` |
| 4 | `config.*file\|configPath\|loadConfig` in `*.ts` | 4 matches | `themeStore.ts` has existing `config.json` file surface |
| 5 | `searchQuery` in GitHubService | 7 matches | L459-462 builds the GitHub search query string |
| 6 | `pullRequestQueueSearchQualifier` | 12 matches | Domain function building search qualifiers |
| 7 | `updated.*since\|updatedSince` | 4 matches | Only in CacheService (row timestamps), not in queries |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/config.ts` | **AppConfig definition + resolution from env vars** | L17-35 |
| 2 | `packages/core/src/runtime.ts` | **makeCoreLayer wires AppConfig into GitHubService** | L12-28 |
| 3 | `src/App.tsx` | **Top-level: resolves config, creates runtime** | L194-202 |
| 4 | `packages/core/src/services/GitHubService.ts` | **Consumes AppConfig; builds search queries** | L459-462 (searchQuery), L620-622 (appConfig usage), L692 (prFetchLimit) |
| 5 | `packages/core/src/themeStore.ts` | **Existing config.json file surface (theme only)** | L18-41 |
| 6 | `packages/core/src/domain.ts` | **pullRequestQueueSearchQualifier** | L20+ |
| 7 | `packages/core/test/githubServiceQueries.test.ts` | Tests for PR query pagination with AppConfig overrides | L18-21, L312+ |

## Code Path Map

### Config Resolution → GitHubService

1. `config.ts:L25-29` — `appConfig` Config object reads `GHUI_PR_FETCH_LIMIT` (default 200), `GHUI_PR_PAGE_SIZE` (default 50), and `GHUI_CACHE_PATH` from env vars via Effect's `Config` module.
2. `config.ts:L31-33` — `resolveAppConfig` yields the Config into an Effect.
3. `config.ts:L35` — `AppConfigLive` is a Layer wrapping `resolveAppConfig`.
4. `App.tsx:L194` — Top-level calls `Effect.runPromise(resolveAppConfig)` to get the concrete `AppConfig` value.
5. `App.tsx:L199-202` — Passes `appConfig` into `makeCoreLayer({ appConfig, mock? })`.
6. `runtime.ts:L18` — `makeCoreLayer` wraps the config into `Layer.succeed(AppConfigService, ...)`.
7. `runtime.ts:L21` — Provides `configLayer` to `GitHubService.layerNoDeps`.
8. `GitHubService.ts:L622` — Inside `layerNoDeps`, `yield* AppConfigService` extracts the config.
9. `GitHubService.ts:L692-693` — `appConfig.prFetchLimit` controls pagination ceiling.

### PR Search Query Construction

1. `GitHubService.ts:L459-462` — `searchQuery(mode, repository)` builds the GitHub search string:
   ```
   `${pullRequestQueueSearchQualifier(mode, repository)} is:pr is:open ${sort}`
   ```
2. `domain.ts:L20+` — `pullRequestQueueSearchQualifier` returns qualifiers like `author:@me archived:false` or `repo:owner/name`.
3. `GitHubService.ts:L638` — The search query is passed as a GraphQL variable to `gh api graphql`.
4. **No `updated:>` qualifier exists anywhere** — the search currently has no date/time window filter.

### Existing Config File Surface

1. `themeStore.ts:L18-22` — `configDirectory()` resolves `GHUI_CONFIG_DIR` → `XDG_CONFIG_HOME/ghui` → `~/.config/ghui`.
2. `themeStore.ts:L25` — `configPath()` → `{configDirectory}/config.json`.
3. `themeStore.ts:L27-41` — Read/write cycle: JSON parse, merge fields, write back.
4. **This file surface is theme-only** (`StoredConfig` interface at L9-16). It does NOT feed into `AppConfig`/`AppConfigService`.

## Architectural Context

- **Module**: `packages/core/src/config.ts` is the canonical config module. It uses Effect's `Config` provider (env-var backed by default).
- **Two config systems exist in parallel**:
  1. `AppConfig` (Effect `Config` → env vars) — feeds `GitHubService` via DI. Fields: `prFetchLimit`, `prPageSize`, `cachePath`.
  2. `themeStore.ts` config.json — file-based, theme/appearance only. Completely separate from `AppConfig`.
- **No config-file reader feeds AppConfig today.** All `AppConfig` values come from env vars or hardcoded defaults.
- **Dependencies**: Effect (`Config`, `Context`, `Layer`), `gh` CLI (for GraphQL queries).
- **Related Tests**: `packages/core/test/githubServiceQueries.test.ts` (tests pagination with `testAppConfig` overrides), `packages/core/test/domain.test.ts` (search qualifier tests).

## Best Integration Point for `updated-since` Window

**Option A — AppConfig field (recommended):**
1. Add `prUpdatedSince: string | null` to `AppConfig` interface (`config.ts:L17`).
2. Add a new `Config.string("GHUI_PR_UPDATED_SINCE")` with `Config.withDefault(null)` or a default like `"4w"` to the `appConfig` Config object (`config.ts:L25-29`).
3. In `searchQuery()` (`GitHubService.ts:L459-462`), if `appConfig.prUpdatedSince` is set, append `updated:>${computedDate}` to the query string. This requires `appConfig` to be in scope — currently `searchQuery` is a module-level function. It would need to either become a closure inside `layerNoDeps` (where `appConfig` is available at L622) or accept the value as a parameter.

**Option B — Config file integration:**
- Extend `themeStore.ts`'s `StoredConfig` (or create a unified config reader) to also feed `AppConfig` fields. This is a larger refactor since the two systems are currently fully separate.

**Concrete touch points for Option A:**
- `packages/core/src/config.ts` L17-29 — add field + env var reader
- `packages/core/src/services/GitHubService.ts` L459-462 — append `updated:>` qualifier
- `packages/core/src/services/GitHubService.ts` L622 — `appConfig` is already available here; `searchQuery` could be moved inside the closure or take an extra param
- `packages/core/test/githubServiceQueries.test.ts` L18-21 — update `testAppConfig` factory
- `packages/core/test/domain.test.ts` — if qualifier logic moves

## Summary

`AppConfig` is a 3-field interface (`prFetchLimit`, `prPageSize`, `cachePath`) defined in `packages/core/src/config.ts`, resolved entirely from env vars via Effect's `Config` module. It flows through `makeCoreLayer` → `Layer.succeed(AppConfigService)` → `GitHubService.layerNoDeps`. A separate file-based config (`~/.config/ghui/config.json`) exists in `themeStore.ts` but is theme-only and disconnected from `AppConfig`. PR search queries are built in `GitHubService.ts:L459-462` with no date window filter. The cleanest integration point for a default `updated-since` window is adding a field to `AppConfig` and appending an `updated:>` qualifier in `searchQuery()`.
