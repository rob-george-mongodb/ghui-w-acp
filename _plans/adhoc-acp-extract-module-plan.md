# Plan: Extract ACP to a standalone `@ghui/acp` package

**Status**: Draft — awaiting human signoff  
**Branch**: `adhoc-plan/acp-extract-module-1`  
**Research files**: `_findings/codebase-research-*.md` (existing corpus)

---

## Problem Summary

The ACP integration (agent session lifecycle, review findings, session messages, report submission, and the MCP tool server that agents call into) currently lives embedded in `packages/core` and `src/`. It cannot be used outside this application without pulling in the entire core package.

The goal is to extract every ACP-specific concern into a new workspace package (`packages/acp`) with:

1. **A public API** that lets any consumer initiate and drive ACP sessions exactly as ghui does today.
2. **Its own SQLite database** (configurable path, default `~/.cache/ghui/acp.sqlite`), completely separate from the PR-caching database.

---

## Current Code Context

### Files that constitute "the ACP portions"

| File | What it does | Disposition |
|------|-------------|-------------|
| `packages/core/src/services/ACPService.ts` | Spawns agent process, drives ACP protocol, manages in-memory session handles | **Move** to `packages/acp/src/services/ACPService.ts` |
| `packages/core/src/services/ReviewWatcher.ts` | Polls `findings.jsonl`; upserts `ReviewFinding` via cache | **Move** to `packages/acp/src/services/ReviewWatcher.ts` |
| `packages/core/src/services/CacheService.ts` (ACP tables) | `review_worktrees`, `review_sessions`, `session_messages`, `review_reports`, `review_findings` and all their CRUD methods | **Split out** into a new `ACPStore` service inside `packages/acp` |
| `src/mcp/server.ts` | The MCP stdio server that ACP agents call. `report_finding` writes to `findings.jsonl`; `submit_pr_report` writes to SQLite via `GHUI_CACHE_PATH` | **Move** to `packages/acp/src/mcp/server.ts` |
| ACP-specific domain types in `packages/core/src/domain.ts` | `ReviewFinding`, `ReviewSession`, `SessionMessage`, `ReviewReport`, `ReviewWorktree`, `FindingSeverity/Status/Source`, `ReviewVerdict`, `ReviewSessionType`, `SessionMessageRole` | **Move** to `packages/acp/src/domain.ts`; re-export thin stubs from `@ghui/core` for compat |

### Files that are **not** ACP-specific (stay in core / app)

| File | Note |
|------|------|
| `packages/core/src/services/CacheService.ts` (PR tables) | `pull_requests`, `queue_snapshots` — untouched |
| `packages/core/src/services/WorktreeService.ts` | Git worktree management. Depends on `CommandRunner` + `AppConfigService`; no ACP protocol dependency. Stays in `@ghui/core`. |
| `packages/core/src/config.ts` | `AppConfigService` / `GhuiJsonConfig` including `acp.agents` section. ACP module receives a simplified config struct (see below); no direct dependency on `AppConfigService`. |
| `src/App.tsx`, `src/ui/acpModals.tsx` | UI layer. Imports change from `@ghui/core` → `@ghui/acp`. |

### Current coupling that the extraction must break

`ACPService` currently depends on `AppConfigService` to read `config.jsonConfig.acp`. After extraction, the ACP module must receive agent configuration as a plain value, so consumers are not forced to adopt `AppConfigService`.

`ACPService` takes `PullRequestItem` as argument to `startReviewSession` / `startChatSession`, but only uses `pr.repository` and `pr.number` to compute the `prKey`. The extracted module will accept a minimal `ACPPrRef` type instead. `PullRequestItem` satisfies this interface structurally, so no call-site changes are required.

The MCP server currently reads `GHUI_CACHE_PATH` to find the SQLite db. After extraction it reads `GHUI_ACP_STORE_PATH`. `ACPService.createSession` currently passes `GHUI_CACHE_PATH` to the spawned MCP server; after extraction it will pass `GHUI_ACP_STORE_PATH` pointing at the ACP-module's own database.

---

## Proposed Changes

### 1. New package: `packages/acp/`

```
packages/acp/
  package.json           (@ghui/acp, private, workspace:*)
  tsconfig.json
  src/
    domain.ts            (ACP domain types moved from @ghui/core)
    services/
      ACPService.ts      (moved + adapted)
      ACPStore.ts        (new: extracted from CacheService; owns its own SQLite)
      ReviewWatcher.ts   (moved; depends on ACPStore not CacheService)
    mcp/
      server.ts          (moved from src/mcp/server.ts; reads GHUI_ACP_STORE_PATH)
    runtime.ts           (makeACPLayer factory — the primary consumer entry point)
    index.ts             (public API barrel)
  test/
    acpStore.test.ts     (migrated from packages/core/test/cacheService.test.ts ACP sections)
    reviewWatcher.test.ts (moved from packages/core/test/reviewWatcher.test.ts)
```

#### `packages/acp/package.json` (sketch)
```json
{
  "name": "@ghui/acp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@agentclientprotocol/sdk": "*",
    "@effect/sql-sqlite-bun": "*",
    "effect": "*"
  }
}
```

No dependency on `@ghui/core`.

---

### 2. `ACPStore` service (new, replaces ACP half of `CacheService`)

Lives at `packages/acp/src/services/ACPStore.ts`.

```typescript
export class ACPStore extends Context.Service<ACPStore, {
  // worktrees
  upsertWorktree(entry: ReviewWorktree): Effect<void>
  listWorktrees(): Effect<readonly ReviewWorktree[]>
  deleteWorktree(prKey: string): Effect<void>
  // sessions
  upsertSession(session: ReviewSession): Effect<void>
  endSession(sessionId: string, endedAt: Date, stopReason?: string): Effect<void>
  listSessions(prKey: string): Effect<readonly ReviewSession[]>
  // messages
  appendMessage(msg: SessionMessage): Effect<void>
  listMessages(sessionId: string): Effect<readonly SessionMessage[]>
  // reports
  upsertReport(report: ReviewReport): Effect<void>
  getReport(sessionId: string): Effect<ReviewReport | null>
  // findings
  upsertFinding(finding: ReviewFinding): Effect<void>
  listFindings(prKey: string): Effect<readonly ReviewFinding[]>
  updateFindingStatus(id: string, status: FindingStatus, modifiedBody?: string): Effect<void>
  markFindingPosted(id: string, url: string): Effect<void>
}>()("ghui/ACPStore") {
  static readonly disabledLayer: Layer<ACPStore>
  static readonly layerSqliteFile(path: string): Layer<ACPStore, SqlError | MigrationError>
  static readonly layerFromPath(path: string | null): Layer<ACPStore>
}
```

Schema migrations (currently migration `"002_acp_review"` in `CacheService`) move entirely into `ACPStore`.

---

### 3. Adapted `ACPService` 

Primary change: replace the `AppConfigService` dependency with a plain `ACPConfig` value:

```typescript
interface ACPAgentConfig {
  readonly name: string
  readonly command: readonly string[]
}

interface ACPConfig {
  readonly agents: readonly ACPAgentConfig[]
  readonly defaultAgent?: string
}
```

Replace `AppConfigService` dependency with a new `ACPConfigService`:

```typescript
export class ACPConfigService extends Context.Service<ACPConfigService, ACPConfig>()("ghui/ACPConfig") {}
```

`ACPService.layer` depends on `ACPConfigService | ACPStore | ReviewWatcher`.

Replace `PullRequestItem` parameter with minimal ref:

```typescript
export interface ACPPrRef {
  readonly repository: string
  readonly number: number
}
// startReviewSession(pr: ACPPrRef, worktreePath: string): Effect<ReviewSession, ACPError>
```

The env var passed to the MCP server subprocess changes from `GHUI_CACHE_PATH` to `GHUI_ACP_STORE_PATH`.

---

### 4. Adapted MCP server

`src/mcp/server.ts` → `packages/acp/src/mcp/server.ts`.

Only one env var change: reads `GHUI_ACP_STORE_PATH` instead of `GHUI_CACHE_PATH`. Everything else is identical.

---

### 5. `makeACPLayer` — the consumer entry point

`packages/acp/src/runtime.ts`:

```typescript
export interface ACPLayerOptions {
  readonly storePath: string | null     // null = in-memory / disabled persistence
  readonly agentConfig?: ACPConfig      // defaults to opencode-acp if omitted
}

export const makeACPLayer = (options: ACPLayerOptions): Layer<ACPService | ACPStore> => {
  const configLayer = Layer.succeed(ACPConfigService, options.agentConfig ?? defaultACPConfig)
  const storeLayer = ACPStore.layerFromPath(options.storePath)
  const watcherLayer = ReviewWatcher.layer.pipe(Layer.provide(storeLayer))
  const acpLayer = ACPService.layer.pipe(
    Layer.provide(configLayer),
    Layer.provide(storeLayer),
    Layer.provide(watcherLayer),
  )
  return Layer.mergeAll(acpLayer, storeLayer)
}
```

A consumer can do:

```typescript
import { makeACPLayer, ACPService } from "@ghui/acp"

const layer = makeACPLayer({ storePath: "~/.cache/myapp/acp.sqlite" })

Effect.runPromise(
  ACPService.use(acp => acp.startReviewSession({ repository: "owner/repo", number: 42 }, "/path/to/worktree"))
    .pipe(Effect.provide(layer))
)
```

---

### 6. Changes to `@ghui/core`

| File | Change |
|------|--------|
| `packages/core/src/services/CacheService.ts` | Remove ACP CRUD methods and migrations (`002_acp_review`). CacheService interface shrinks. |
| `packages/core/src/services/ACPService.ts` | Delete (moved to `@ghui/acp`) |
| `packages/core/src/services/ReviewWatcher.ts` | Delete (moved to `@ghui/acp`) |
| `packages/core/src/domain.ts` | Remove ACP-specific types. Re-export them from `@ghui/acp` for compatibility if needed. |
| `packages/core/src/index.ts` / `index-node.ts` | Remove ACP exports; add `@ghui/acp` re-exports where currently imported by app code |
| `packages/core/src/runtime.ts` | Import `makeACPLayer` from `@ghui/acp`; pass `{ storePath: appConfig.acpStorePath, agentConfig: ... }` |

### 7. Changes to app config (`packages/core/src/config.ts`)

Add `acpStorePath` to `AppConfig`:

```typescript
export interface AppConfig {
  // ... existing fields ...
  readonly acpStorePath: string | null   // new; resolves GHUI_ACP_STORE_PATH or ~/.cache/ghui/acp.sqlite
}
```

Derive it similarly to `cachePath`. Default: `~/.cache/ghui/acp.sqlite` (separate from PR cache).

Pass `acpStorePath` and the `acp` section of `jsonConfig` into `makeACPLayer` from `runtime.ts`.

### 8. Changes to `src/App.tsx` and `src/ui/acpModals.tsx`

- Import `ACPService`, `ACPError`, `ReviewFinding`, `ReviewSession`, `SessionMessage`, `ReviewReport`, `ReviewWorktree` from `@ghui/acp` instead of `@ghui/core`.
- Calls to `CacheService.use(cache => cache.upsertFinding(...))` etc. move to `ACPStore.use(store => store.upsertFinding(...))`.
- The `cancelSession` / `closeSession` calls currently not wired in App will remain in ACPService's public API but can stay dormant.

### 9. The `standalone.ts` MCP server dispatch

`src/standalone.ts` currently does `runMcpServer()` for the `mcp-server` subcommand. After the move, it imports from `@ghui/acp`:

```typescript
import { runMcpServer } from "@ghui/acp/mcp"
```

No behavioural change needed; the env var switch (`GHUI_ACP_STORE_PATH`) is handled inside the moved module.

---

## Verification Plan

1. **Existing tests pass unchanged**: `bun run test` (covers `cacheService.test.ts`, `reviewWatcher.test.ts`, etc.). The test files themselves move to `packages/acp/test/` and are updated to import from `@ghui/acp`.

2. **New integration test for `makeACPLayer`** in `packages/acp/test/acpLayer.test.ts`:
   - Construct a layer with a temp `storePath`
   - Verify `ACPStore` is populated after session upsert
   - Verify `makeACPLayer` with `storePath: null` returns disabled (no-op) store

3. **Typecheck**: `bun run typecheck` across all packages must pass with zero errors.

4. **Lint/format**: `bun run lint` and `bun run format:check` must pass.

5. **MCP server smoke**: Run the extracted MCP server binary with `GHUI_REVIEW_DIR=/tmp/test-review GHUI_ACP_STORE_PATH=/tmp/test.sqlite`. Confirm it starts, registers tools, and handles a `list_tools` call without crashing.

6. **App smoke**: `bun run start:mock` must render without runtime errors; ACP modals should remain accessible.

---

## Risks / Open Questions

| # | Risk / Question | Severity | Proposed resolution |
|---|----------------|----------|---------------------|
| 1 | **Data migration for existing users** — current ACP data lives in `~/.cache/ghui/cache.sqlite` (same DB as PR cache). Extracting to `acp.sqlite` silently abandons existing session/finding rows. | Low — session data is ephemeral and not user-precious | On first run, if `acp.sqlite` doesn't exist and old DB has ACP tables, emit a one-time notice. No automatic migration. |
| 2 | **WorktreeService stays in core** — is that the right call? It has no ACP dependency but is only used in the ACP flow. | Medium | Keeping it in `@ghui/core` is correct because its concerns (git worktrees, `repoMappings`) are independent of ACP. The app wires WorktreeService + ACPService together. Revisit if a standalone consumer wants worktree management too. |
| 3 | **`@ghui/core` still exports ACP types** — re-exporting from `@ghui/acp` adds a transitive dependency on `@effect/sql-sqlite-bun` into `@ghui/core`'s public type surface. | Low — both are private workspace packages | Types can be re-exported without the runtime dependency because TypeScript strips them. The bundler will not pull in SQLite if the consumer only uses types. |
| 4 | **`ACPConfigService` vs passing config directly** — is a `Context.Service` wrapper for a plain config object warranted? | Low | A `Context.Service` preserves testability (easy mock) and is consistent with existing patterns. Worth the boilerplate. |
| 5 | **MCP server binary entry point** — `src/standalone.ts` currently runs `runMcpServer()` directly. After move, the import path changes. The standalone binary is bundled; the bundler must resolve `@ghui/acp`. | Low — already uses workspace packages | `packages/acp` is a workspace member; bundler sees it the same way it sees `@ghui/core`. |
| 6 | **`GHUI_ACP_STORE_PATH` env var naming** — current MCP server uses `GHUI_CACHE_PATH`. Renaming is a breaking change for any user who has manually configured the env var. | Low — unlikely to be set by end users | Accept the rename. Document in changelog. |

---

## Relevant Files / Research References

| File | Description |
|------|-------------|
| `packages/core/src/services/ACPService.ts` (L1–282) | Full ACP session lifecycle |
| `packages/core/src/services/ReviewWatcher.ts` (L1–96) | Findings file polling |
| `packages/core/src/services/CacheService.ts` (L283–374, migration `002_acp_review`) | ACP schema and CRUD |
| `packages/core/src/runtime.ts` (L1–36) | Layer composition — shows all dependencies |
| `packages/core/src/config.ts` (L1–88) | Config loading — shows `acp.agents` structure |
| `src/mcp/server.ts` (L1–175) | MCP tool server — target for relocation |
| `src/App.tsx` (L63–65, L585–597) | ACP usage in the app layer |
| `src/ui/acpModals.tsx` (L1–10) | ACP UI imports |
| `packages/core/test/cacheService.test.ts` | Tests that cover ACP store tables (to migrate) |
| `packages/core/test/reviewWatcher.test.ts` | Tests to migrate to `packages/acp/test/` |
| `_findings/codebase-research-acp-sdk-api-surface.md` | ACP SDK protocol notes |
| `_findings/codebase-research-opencode-acp.md` | opencode ACP integration notes |
