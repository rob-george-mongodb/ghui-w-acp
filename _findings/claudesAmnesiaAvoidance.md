# Claude's Amnesia Avoidance Notes

## Repository Layout (Critical — different from what the plan doc says)

The plan doc says `src/config.ts`, `src/domain.ts`, `src/services/CacheService.ts` etc.
**THESE ARE WRONG.** The actual layout is:

- `packages/core/src/config.ts` — AppConfig, NOT `src/config.ts`
- `packages/core/src/domain.ts` — All domain types
- `packages/core/src/services/CacheService.ts` — SQLite cache
- `packages/core/src/services/GitHubService.ts` — GitHub API
- `packages/core/src/services/WorktreeService.ts` — NEW (to create)
- `packages/core/src/services/ACPService.ts` — NEW (to create)
- `packages/core/src/services/ReviewWatcher.ts` — NEW (to create)
- `packages/core/src/index.ts` — barrel export; must be updated for new types
- `src/standalone.ts` — Binary entry point (add `mcp-server` subcommand)
- `src/mcp/server.ts` — NEW MCP server (to create)
- `src/App.tsx` — TUI app (~2500 lines); new UI modals live here or companion files

**Plan says `src/services/...` — the correct path is `packages/core/src/services/...`**

## Key Packages
- Root `package.json` has all runtime deps
- `packages/core/package.json` is private and lists no external deps (uses workspace)
- New deps must go in ROOT `package.json`:
  - `@agentclientprotocol/sdk@0.21.0` (latest as of 2026-05-10)
  - `@modelcontextprotocol/sdk@1.29.0` (latest as of 2026-05-10)

## Already-Existing Methods (no need to add)
- `GitHubService.createPullRequestIssueComment(repository, number, body)` already exists!
  - Plan says to add it — it's ALREADY THERE
  - Returns `PullRequestComment`, which has `id` and `url`

## CacheService Patterns
- Uses `@effect/sql-sqlite-bun`, Effect SQL, migrations via `Migrator.fromRecord(cacheMigrations)`
- Migration table: `ghui_cache_migrations`
- WAL enabled by SqliteClient; additional pragmas applied in `applyPragmas` 
- Use `Effect.fn("CacheService.methodName")` wrapper for methods
- Error type: `CacheError` with `operation` and `cause` fields
- Pattern: `toCacheError(operation, cause)` to normalize errors
- `sql.withTransaction(write)` for multi-step writes
- **Post-refactor**: Interface is `CacheService`, Bun impl is `BunCacheService` (split for Electron compatibility)

## Config Patterns (AppConfig)
- Lives in `packages/core/src/config.ts`
- Uses `Effect.Config` API (Config.int, Config.string, etc.)
- `AppConfigService extends Context.Service<...>()("ghui/AppConfig")`
- `AppConfigLive = Layer.effect(AppConfigService, resolveAppConfig)`
- New JSON config: `${XDG_CONFIG_HOME:-~/.config}/ghui/ghui.json`
  - `GhuiJsonConfig` interface: `repoMappings`, `acp`, `worktreeRoot`
  - Missing file = defaults; parse error = warn + defaults (never crash)

## ACP Protocol (Critical Architecture)
- `opencode acp` spawns an NDJSON-over-stdio ACP agent process
- ghui acts as `ClientSideConnection` from `@agentclientprotocol/sdk`
- Custom tools (report_finding, submit_pr_report) are exposed via MCP server
- ghui passes MCP server to opencode in `newSession({ mcpServers: [...] })`
- ACP McpServer format for local/stdio:
  ```ts
  { name: string, command: string, args: string[], env: Array<{name: string, value: string}> }
  ```
- `GHUI_SESSION_ID` is set in MCP env AFTER `newSession` returns (opencode spawns MCP server after that)

## MCP Server Key Points
- Binary entry: `process.execPath` (same ghui binary in both dev and standalone modes)
- Dev mode: `process.execPath` = Bun binary, dispatches through standalone.ts → `mcp-server` subcommand
- Standalone mode: `process.execPath` = ghui binary, same dispatch
- Environment variables consumed: `GHUI_REVIEW_DIR`, `GHUI_PR_KEY`, `GHUI_SESSION_ID`
- `report_finding` → appends JSON line to `$GHUI_REVIEW_DIR/findings.jsonl`
- `submit_pr_report` → copies file to `$GHUI_REVIEW_DIR/report-<sessionId>.md` AND writes to SQLite review_reports

## MCP Server (submit_pr_report) + SQLite Cross-Process
- The MCP server is a subprocess spawned by opencode (different process from ghui TUI)
- It DOES write to SQLite for `submit_pr_report` (plan explicitly says so)
- This is acceptable because WAL mode + busy_timeout = 5000 handles it
- The `findings.jsonl` file-based handoff avoids cross-process SQLite for the high-frequency `report_finding`

## File Watcher (ReviewWatcher)
- Uses Bun.file + polling at 500ms
- Tracks last byte offset read (to avoid re-processing)
- Partial-line safety: only reads up to last \n in each poll
- Each line independently JSON.parse'd; failures = skip + warn (never crash)
- Final sweep triggered by ACPService after session/prompt returns

## Git Worktree Structure
- `<worktreeRoot>/<owner>/<repo>/<pr-number>/` — git worktree (full repo)
- `<worktreeRoot>/<owner>/<repo>/<pr-number>/.ghui-review/` — review dir
  - `findings.jsonl` — written by MCP server, watched by ReviewWatcher
  - `report-<sessionId>.md` — copied by submit_pr_report
  - `human-comments.jsonl` — written by ghui for human drafts
- Default worktreeRoot: `${XDG_DATA_HOME:-~/.local/share}/ghui/worktrees`

## SQLite Schema New Tables (Migration 002)
- `review_worktrees` — tracks git worktrees per PR
- `review_sessions` — tracks ACP sessions (review + chat types)
- `session_messages` — conversation transcript per session
- `review_reports` — full PR review reports submitted via submit_pr_report
- `review_findings` — local draft comments (AI + human)
- Partial unique index `idx_review_sessions_active_type ON (session_type, worktree_path) WHERE ended_at IS NULL`
  — enforces at most one active session per type per worktree

## ACP SDK Key Types (from @agentclientprotocol/sdk@0.21.0)

```typescript
// PROTOCOL_VERSION = 1 (constant exported from schema/index.d.ts)
// ClientSideConnection(toClient: (agent: Agent) => Client, stream: Stream)
// connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
// connection.newSession({ cwd, mcpServers }) → NewSessionResponse { sessionId: string }
// connection.prompt({ sessionId, prompt: [{ type: "text", text: string }] }) → PromptResponse { stopReason }

// McpServerStdio (no `type` field = stdio, vs { type: "http" } = HTTP):
type McpServerStdio = { name: string, command: string, args: string[], env: Array<{ name: string, value: string }> }

// StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled"

// SessionNotification.update discriminated union (sessionUpdate field):
// "agent_message_chunk" → ContentChunk & { sessionUpdate: "agent_message_chunk" }
//   content: ContentBlock = (TextContent & { type: "text" }) | ...
//   TextContent has: text: string
// "tool_call" → ToolCall & { sessionUpdate: "tool_call" }

// RequestPermissionRequest.toolCall.kind: ToolKind (includes "read")
// Auto-allow reads: if (params.toolCall.kind === "read") → allow
```

## Session ID Problem & Resolution

- GHUI_SESSION_ID can't be passed via env in newSession (sessionId only known AFTER newSession returns)
- Resolution: 
  1. Pass GHUI_SESSION_ID as empty string "" in newSession mcpServers env
  2. After newSession returns, write actual sessionId to `$GHUI_REVIEW_DIR/.session-id` file  
  3. MCP server's submit_pr_report reads `.session-id` file lazily if GHUI_SESSION_ID is empty
  4. MCP server already reads REVIEW_DIR from env → can construct path to .session-id

## Implementation Status Tracking

### Completed
- [x] Notes file created

### Phase 1 (In Progress)
- [ ] Domain types (packages/core/src/domain.ts + index.ts)
- [ ] Config extension (packages/core/src/config.ts)
- [ ] Dependencies (package.json + bun install)

### Phase 2 (Pending Phase 1)
- [ ] CacheService additions (migration 002 + new methods)
- [ ] MCP server (src/mcp/server.ts + src/standalone.ts)

### Phase 3 (Pending Phase 2)
- [ ] WorktreeService
- [ ] ReviewWatcher

### Phase 4 (Pending Phase 3)
- [ ] ACPService

### Phase 5 (Pending Phase 4)
- [ ] UI: InitiateReviewModal
- [ ] UI: FindingsPanel + FindingEditModal
- [ ] UI: HumanCommentModal
- [ ] UI: AskAIPanel
- [ ] UI: SessionViewerPanel
- [ ] UI: PostFindingsModal
- [ ] UI: PermissionRequestModal

## Build & Test Commands
- Typecheck: `bun run typecheck` (from root) -- runs tsc + workspace typechecks
- Tests: `bun run test` -- runs root tests + workspace tests
- Lint: `bun run lint`
- Format check: `bun run format:check`
- Core package tests: `bun run --cwd packages/core test`

---

# Electron Implementation Notes

## Key Observations

### Bun → Node.js Gap
1. **CommandRunner.ts** — `Bun.spawn` at L65, `Bun.readableStreamToText` at L45. Interface (Context.Service) and impl (layer) in same file.
   - **Import risk**: The top-level `readStream` function at L43-46 references `Bun.readableStreamToText` — this WILL crash at import time in Node.js. Need to split interface from impl OR use bundler tricks.
   - **Decision**: Split is cleaner. Create `CommandRunner.ts` (interface only) and `CommandRunnerBun.ts` (Bun impl) in core.
2. **CacheService.ts** — imports `@effect/sql-sqlite-bun` at L3. Same issue — import-time crash in Node.js.
   - Same approach: need to either split or have Electron provide its own CacheService.

### Layer Composition
- `makeCoreLayer()` in runtime.ts hardcodes Bun impls. Electron creates its own `makeElectronCoreLayer()`.
- `GitHubService.layerNoDeps`, `Clipboard.layerNoDeps`, `BrowserOpener.layerNoDeps` all depend only on the CommandRunner *interface*, not Bun impl. These are reusable IF we can import them without pulling in Bun.

### Workspace
- Monorepo with `packages/*` workspaces. Adding `packages/electron/` fits naturally.
- Root uses Bun as package manager.

## Implementation Order (from plan)
1. Scaffold Electron package
2. Node.js CommandRunner  
3. Node.js CacheService
4. Electron core layer
5. IPC bridge + protocol
6. PR list pane
7. PR detail pane
8. Comments pane
9. Merge controls
10. Command palette
11. Error handling
12. Packaging

## Phase 1 Tasks (Current)
- [ ] Scaffold `packages/electron/` with electron-vite
- [ ] Create NodeCommandRunner (child_process.spawn)
- [ ] Create NodeCacheService (better-sqlite3)
- [ ] Create makeElectronCoreLayer()
- [ ] IPC protocol types
- [ ] IPC main process handlers
- [ ] Preload bridge

## Critical Decision: Import-time Bun references
The plan mentions option 1 (split interface from impl) or option 2 (bundler stubs). 
Going with option 1 — split in core — because it's cleaner and the Electron bundler shouldn't need to know about Bun internals.

Actually wait — the plan says "No core changes needed" for the layer composition. But the import-time issue IS a problem. Let me re-read...

Plan says: "If this happens, we have two options: 1. Split CommandRunner into interface + impl files in @ghui/core (minor core change). 2. Use the Electron bundler (Vite) to externalize/stub the Bun implementation."

The plan acknowledges this might be needed. Going with option 2 first (bundler externalization) since the plan prefers minimal core changes. If it's messy, fall back to option 1.

Actually — for the Electron main process (Node.js, no bundler), we need to import CommandRunner service tag. The main process isn't bundled by Vite (only renderer is). So option 2 won't work for main process imports.

**Decision: We need option 1 — split CommandRunner interface from Bun impl in core.**

Same for CacheService — split the interface/types from the `@effect/sql-sqlite-bun` impl.

This is a minor core change but necessary. Will flag to human if they object.

## IPC Protocol Gaps (from research)
- Need `pr:mergeMethods` for merge method picker
- `pr:list` should return `PullRequestLoad` (with pagination cursor) not just `PullRequestItem[]`
- Need `pr:issueComment:create` (distinct from review comment create)
- Diff-related channels are out of scope per plan

## Status
- ✅ Core refactoring: CommandRunner/CacheService split from Bun impls
- ✅ Electron scaffold: package, electron-vite, main process, IPC, preload, Node.js CommandRunner
- 🔄 Starting Phase 3: React web UI components
