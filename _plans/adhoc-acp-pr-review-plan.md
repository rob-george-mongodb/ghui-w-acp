# ACP PR Review Integration Plan

**Status**: Draft — ready for human signoff  
**Branch**: `adhoc-plan/acp-pr-review-1`  
**Research files**: `_findings/codebase-research-*.md`

---

## Problem Summary

ghui is a TUI for navigating GitHub pull requests. It has no ability to run an AI review agent against a PR. The request is to integrate an ACP-based agent workflow so that:

1. The user can trigger an autonomous AI review of any PR from within ghui.
2. The agent reports potential PR comments via a custom tool; these surface in ghui for human triage.
3. The human can also author local draft comments alongside the AI ones.
4. Neither AI findings nor human draft comments go to GitHub without an explicit extra step.
5. The human can also ask the AI ad-hoc questions about a PR in an interactive chat.

The target app is called **ghui-w-acp** — the same ghui binary, extended with ACP integration.

---

## Current Code Context

### Relevant source files

| File | Role |
|------|------|
| `src/standalone.ts` | Binary entry point. Dispatches `help`/`version`/`upgrade` subcommands before loading the TUI. New `mcp-server` subcommand added here. |
| `src/config.ts` | Three env-var settings (`GHUI_PR_FETCH_LIMIT`, `GHUI_PR_PAGE_SIZE`, `GHUI_CACHE_PATH`). Must be extended for ACP config via a JSON config file. |
| `src/domain.ts` | All domain types. `PullRequestItem` (L134–156) is the central type. `PullRequestReviewComment` (L108–118) and `CreatePullRequestCommentInput` (L89–98) define what goes to GitHub. |
| `src/services/CacheService.ts` | Effect-based SQLite cache. Uses `@effect/sql-sqlite-bun` with WAL enabled, semaphore-serialised writes, and migration-based schema. New `review_findings` table added here. |
| `src/services/GitHubService.ts` | All GitHub I/O via `gh` CLI. Methods like `createPullRequestComment`, `submitPullRequestReview`. Used for the "post to GitHub" step. |
| `src/App.tsx` | ~2500-line monolith with 40+ Effect atoms. All new UI state (findings, review sessions, chat) lives here or in a new co-located module. |
| `src/ui/` | 18 UI files, 13 modal types. New modals/panels follow the same Ink-component pattern. |

### ACP protocol summary (from research)

- `opencode acp` spawns an internal HTTP server, then bridges ACP JSON-RPC (ndjson over stdio) to opencode's REST API.
- ghui acts as an **ACP client** using `@agentclientprotocol/sdk`'s `ClientSideConnection`.
- The agent calls **MCP tools** (not ACP tools) for custom capabilities. ghui exposes its `report_finding` tool via an **MCP stdio server subprocess** passed to opencode in `newSession({ mcpServers: [...] })`.
- Session updates stream back as `sessionUpdate` notifications carrying `agent_message_chunk` (text) and `tool_call`/`tool_call_update` (tool lifecycle).

### Existing SQLite patterns (from `plans/sqlite-cache.md`)

- Effect SQL stack: `@effect/sql-sqlite-bun`, migration-based schema, `SqlClient.withTransaction` for multi-table writes.
- WAL mode is enabled by `SqliteClient` at open time.
- Cross-process SQLite access is explicitly **out of scope** in the existing plan. We therefore use a **disk-file handoff** (not direct multi-process SQLite writes) to relay MCP-server output back to ghui.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ghui (TUI process)                            │
│                                                                       │
│  InitiateReviewModal ──► ACPReviewService ──► CacheService (SQLite)  │
│  FindingsPanel        ◄──  (file watcher)  ◄── review folder         │
│  AskAIPanel           ──► ACPChatService                             │
└──────────────────────────────────────────────────────────────────────┘
         │ spawns (opencode acp --cwd <local repo>)
         ▼
┌─────────────────────────┐     ┌───────────────────────────────────┐
│   opencode acp          │────►│  ghui mcp-server  (subprocess)    │
│   (ACP agent process)   │ MCP │  • exposes report_finding tool     │
│   ACP ndjson over stdio │     │  • writes to PR review folder     │
└─────────────────────────┘     │    (findings.jsonl + disk JSON)   │
                                └───────────────────────────────────┘
         │ ACP ndjson (stdin/stdout)
         │
ghui ClientSideConnection
• sessionUpdate → stream agent text to AskAIPanel
• requestPermission → approve/reject in TUI
```

### Data flow for "AI findings"

1. ghui writes `context.md` + `diff.patch` to the PR review folder before the session.
2. ghui spawns `opencode acp --cwd <local-repo-path>`.
3. ghui calls `newSession({ mcpServers: [{ name: "ghui-review", command: "ghui", args: ["mcp-server"], env: { GHUI_REVIEW_DIR, GHUI_PR_KEY } }] })`.
4. Agent reads `context.md` and `diff.patch`, performs the review, and calls `report_finding` via MCP.
5. `ghui mcp-server` appends each finding as a JSON line to `<review-dir>/findings.jsonl`.
6. ghui's file watcher detects the append; reads the new lines; writes rows to `review_findings` table in SQLite; updates the `FindingsPanel` atoms.
7. When the session completes, ghui performs a final sweep of `findings.jsonl` to catch any trailing lines.

### Data flow for "ask AI" (Q&A session)

1. User opens `AskAIPanel` on a PR (key binding TBD).
2. ghui spawns a new `opencode acp` session (same MCP server, so `report_finding` is available in Q&A too).
3. ghui sends the initial context prompt (includes review folder path so the agent can load context).
4. User types questions; ghui sends them via `session/prompt`.
5. Agent text streams back via `sessionUpdate` `agent_message_chunk` → shown in `AskAIPanel`.
6. Any `report_finding` calls during Q&A are handled identically to review session calls.

---

## Proposed Changes

### 1. `ghui mcp-server` subcommand

**File**: `src/standalone.ts`

Add `"mcp-server"` to the recognised commands list and dispatch to a new `src/mcp/server.ts` module before falling through to the TUI.

The MCP server command registered in `newSession` uses the **same binary path** that ghui itself runs as: `process.execPath` in dev (Bun) and the standalone binary path in production. The subcommand dispatch in `standalone.ts` must be updated before the binary can act as an MCP server. Both modes (dev `bun run` and standalone binary) must be explicitly tested — the `bun run` path sets `process.execPath` to the Bun binary, which correctly routes through the updated `standalone.ts`.

**File**: `src/mcp/server.ts` (new)

A minimal MCP server using `@modelcontextprotocol/sdk/server/` over stdio. Registers one tool:

```typescript
{
  name: "report_finding",
  description: "Report a significant PR review finding that may warrant a comment.",
  inputSchema: {
    type: "object",
    properties: {
      title:      { type: "string", description: "One-line summary" },
      body:       { type: "string", description: "Markdown comment text" },
      severity:   { type: "string", enum: ["info", "warning", "error", "blocking"] },
      file_path:  { type: "string", description: "Repo-relative path; omit for PR-level comments" },
      line_start: { type: "integer" },
      line_end:   { type: "integer" },
      diff_side:  { type: "string", enum: ["LEFT", "RIGHT"],
                    description: "Diff side. Defaults to RIGHT (new file). Use LEFT for deleted lines." },
    },
    required: ["title", "body", "severity"],
  },
}
```

On each call, the server:
1. Generates a UUID for the finding.
2. Appends a JSON line to `$GHUI_REVIEW_DIR/findings.jsonl`.
3. Returns `{ id, status: "recorded" }`.

The append to `findings.jsonl` uses a write-then-newline pattern where the newline is written **atomically with the JSON content** (single `write` syscall) to prevent ghui's file watcher from reading a partial line. If `JSON.parse` fails on a line read by the watcher, that line is skipped and retried on the next poll cycle (defensive parse, never crash).

Environment variables consumed: `GHUI_REVIEW_DIR`, `GHUI_PR_KEY`.

### 2. Config extension

**File**: `src/config.ts` (extend)

Add a second config source: a JSON file at  
`${XDG_CONFIG_HOME:-~/.config}/ghui/ghui.json`

```typescript
interface GhuiJsonConfig {
  /** Map of "owner/repo" → absolute local path */
  repoMappings?: Record<string, string>

  acp?: {
    /** One or more agent configurations */
    agents: Array<{
      name: string
      /** Command array to spawn, e.g. ["opencode", "acp"] */
      command: string[]
      /** Default model to request via setSessionConfigOption */
      defaultModel?: string
    }>
    defaultAgent?: string
  }

  /** Absolute path where review folders are stored.
   *  Default: ${XDG_DATA_HOME:-~/.local/share}/ghui/reviews */
  reviewDataDir?: string
}
```

Config is read once at startup with `JSON.parse` + a lightweight Zod/Effect Schema validation. Missing file = use defaults silently. Parse error = warn and use defaults (never crash).

### Review folder layout — within `--cwd`

To allow the agent's built-in `read` tool to access review files without triggering `requestPermission` for every file read outside the working directory, review files are written **inside the local repo** at a `.ghui-review/` folder under `--cwd`. The review data directory config (`reviewDataDir`) becomes the root for a symlink or is replaced with the repo-local path entirely.

Revised folder layout (under `<local-repo-path>/.ghui-review/<pr-number>/`):

```
<local-repo-path>/.ghui-review/<pr-number>/
├── context.md               ← written by ghui before session
├── diff.patch               ← written by ghui before session
├── findings.jsonl           ← appended by MCP server
└── human-comments.jsonl     ← appended by ghui for human drafts
```

This folder is added to the repo's `.gitignore` (or a global gitignore) but is also **symlinked** from the canonical `reviewDataDir` location (`~/.local/share/ghui/reviews/<owner>/<repo>/<pr-number>/`) so that cross-session persistence and cross-repo browsing still work via the canonical path. The symlink target is always the repo-local `.ghui-review/<pr-number>/` folder.

The `GHUI_REVIEW_DIR` env var passed to the MCP server always points to the canonical symlink target (the actual `.ghui-review/<pr-number>/` path).

**Alternative**: If `.ghui-review/` inside the repo is unacceptable to the user (e.g. working directory is read-only or shared), the fallback is to pre-populate the initial prompt text with the full content of `context.md` and `diff.patch` rather than file paths. This is noted as a config option but not the default.

### 3. Review folder layout

```
<local-repo-path>/.ghui-review/<pr-number>/
├── context.md        ← written by ghui before session; readable by agent
├── diff.patch        ← written by ghui before session; readable by agent
├── findings.jsonl    ← appended by MCP server; read by ghui watcher
└── human-comments.jsonl  ← appended by ghui when human drafts a comment
```

`context.md` contains: PR title, description, author, labels, branch names, headRefOid, stats (additions/deletions/changed files), URL. Written in a structured markdown format that is useful to the agent as context.

The entire review folder path is advertised in the agent's initial prompt so the agent can `read` these files using its own tools (opencode's built-in `read` tool reads from `--cwd`). The `--cwd` passed to opencode should be the local repo path from `repoMappings`.

### 4. SQLite schema addition

New migration in `CacheService` migrations record:

```sql
-- Migration: 002_review_findings
CREATE TABLE IF NOT EXISTS review_findings (
  id              TEXT NOT NULL PRIMARY KEY,
  pr_key          TEXT NOT NULL,   -- "<owner>/<repo>#<number>"
  head_ref_oid    TEXT NOT NULL,   -- headRefOid at review time; used for posting
  source          TEXT NOT NULL CHECK (source IN ('ai', 'human')),
  session_id      TEXT,            -- ACP session ID; NULL for human comments
  file_path       TEXT,            -- NULL = PR-level comment (→ issue comment on post)
  line_start      INTEGER,
  line_end        INTEGER,
  diff_side       TEXT CHECK (diff_side IN ('LEFT', 'RIGHT')),  -- NULL for PR-level
  title           TEXT,
  body            TEXT NOT NULL,
  severity        TEXT CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'accepted', 'rejected', 'modified')),
  modified_body   TEXT,            -- user-edited version of body
  posted_url      TEXT,            -- GitHub URL once posted; NULL = not yet posted
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_findings_pr_key
  ON review_findings (pr_key);
```

**Key fields added vs initial draft:**
- `head_ref_oid`: captures the commit SHA at review time. When posting to GitHub via `createPullRequestComment`, this becomes `commitId`. If the PR has new commits since the review, the user is warned that line numbers may be stale.
- `diff_side`: the LEFT/RIGHT side required by `CreatePullRequestCommentInput`. The `report_finding` MCP tool accepts an optional `diff_side` field ("LEFT" or "RIGHT", default "RIGHT"). If absent, ghui defaults to "RIGHT" (the new-file side, which is correct for additions/changes).

New `CacheService` methods:

```typescript
readonly upsertFinding: (finding: ReviewFinding) => Effect<void, never>
readonly listFindings: (prKey: string) => Effect<readonly ReviewFinding[], CacheError>
readonly updateFindingStatus: (id: string, status: FindingStatus, modifiedBody?: string) => Effect<void, never>
readonly markFindingPosted: (id: string, url: string) => Effect<void, never>
```

### 5. Domain types addition

**File**: `src/domain.ts` (extend)

```typescript
export const findingSeverities = ["info", "warning", "error", "blocking"] as const
export type FindingSeverity = (typeof findingSeverities)[number]

export const findingStatuses = ["pending_review", "accepted", "rejected", "modified"] as const
export type FindingStatus = (typeof findingStatuses)[number]

export const findingSources = ["ai", "human"] as const
export type FindingSource = (typeof findingSources)[number]

export interface ReviewFinding {
  readonly id: string
  readonly prKey: string
  readonly headRefOid: string   // commit SHA at review time
  readonly source: FindingSource
  readonly sessionId: string | null
  readonly filePath: string | null
  readonly lineStart: number | null
  readonly lineEnd: number | null
  readonly diffSide: DiffCommentSide | null  // "LEFT" | "RIGHT"; null for PR-level
  readonly title: string | null
  readonly body: string
  readonly severity: FindingSeverity | null
  readonly status: FindingStatus
  readonly modifiedBody: string | null
  readonly postedUrl: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
```

### 6. ACP service layer

**File**: `src/services/ACPService.ts` (new)

Wraps `@agentclientprotocol/sdk`'s `ClientSideConnection`. Responsibilities:

- Spawn `opencode acp --cwd <localRepoPath>` as a child process.
- Construct ndjson stream from the process's stdin/stdout.
- Create `ClientSideConnection` implementing `Client`:
  - `sessionUpdate`: dispatch to an Effect Queue that the TUI atoms subscribe to.
  - `requestPermission`: in MVP, auto-allow file reads; auto-allow tool calls within `--cwd`; reject writes outside `--cwd`. Log decisions for debugging.
- **Process lifecycle**: track all spawned `opencode acp` child processes. On ghui exit (SIGTERM, SIGINT, `process.on('exit')`), send SIGTERM to all tracked child processes. On `closeSession`, kill only that session's process.
- Expose Effect-friendly API:
  - `startReviewSession(pr: PullRequestItem): Effect<SessionId, ACPError>`
  - `startChatSession(pr: PullRequestItem): Effect<SessionId, ACPError>`
  - `sendPrompt(sessionId, text): Effect<PromptResponse, ACPError>`
  - `cancelSession(sessionId): Effect<void, never>`
  - `closeSession(sessionId): Effect<void, never>`

At most one ACP session (of either type) per PR key is allowed. `startReviewSession` or `startChatSession` returns an error if a session already exists for that PR key.

The MCP server registration passed in `newSession`:

```typescript
mcpServers: [{
  name: "ghui-review",
  command: process.execPath,          // the ghui binary
  args: ["mcp-server"],
  env: [
    { name: "GHUI_REVIEW_DIR", value: reviewDir },
    { name: "GHUI_PR_KEY",     value: prKey },
  ],
}]
```

**Initial review prompt template** (sent as the first `session/prompt`):

```
You are reviewing a GitHub pull request.

Repository: <owner>/<repo>
PR: #<number> — <title>
Branch: <headRefName> → base
Author: <author>

Review context, PR description, and the full diff are at:
  <reviewDir>/context.md
  <reviewDir>/diff.patch

Any findings you have already reported are at:
  <reviewDir>/findings.jsonl

Review the pull request. For any significant findings that warrant a PR comment,
call `report_finding`. Focus on correctness, security, performance, and API design.
Omit trivial style issues unless they violate explicit project conventions.
```

### 7. File watcher

**File**: `src/services/ReviewWatcher.ts` (new)

Uses Bun's `Bun.file` + polling at 500 ms to detect new complete lines in `findings.jsonl`. Tracks the last byte offset read to avoid re-processing.

**Partial-line safety**: reads only up to the last `\n` character in each poll. Any trailing bytes (potentially a partial line mid-write) are left for the next poll. Each line is independently `JSON.parse`d; parse failures log a warning and skip that line — never crash or stop watching.

**Final sweep**: triggered by the `ACPService` immediately after the `session/prompt` call returns (the prompt call blocks until the agent turn completes; by that point all MCP tool calls have returned, so all `report_finding` writes have completed). The watcher reads from its current offset to end-of-file to catch any lines not yet imported. The watcher is then torn down.

Polling interval: 500 ms during an active session; watcher torn down after the final sweep when the session ends.

### 8. UI additions

All new UI follows existing Ink + `jotai-effect` atom patterns from `src/App.tsx`.

#### `InitiateReviewModal`

- Triggered by a new key binding on a selected PR (e.g., `ctrl+r`).
- Shows: PR title, selected agent (from config), local repo path (from `repoMappings`).
- Error if `repoMappings` has no entry for this repo.
- Confirm → calls `ACPService.startReviewSession(pr)`.

#### `FindingsPanel` (in-PR view section)

- Shown when a PR has any findings (AI or human) in `review_findings`.
- Lists findings grouped by source and status.
- Each finding row shows: severity badge, title, file:line (if present), status.
- Key actions per finding: `a` accept, `r` reject, `e` edit (opens `FindingEditModal`), `p` post to GitHub (only if accepted).

#### `FindingEditModal`

- Opens on `e` over a finding.
- Editable textarea pre-filled with finding body.
- Saving sets `status = "modified"` and writes `modifiedBody`.

#### `HumanCommentModal`

- Triggered by a new key binding (e.g., `ctrl+c`) on a PR.
- Allows the human to draft a local comment: optionally file path + line range + body.
- Saved as `source = "human"` in `review_findings` and appended to `human-comments.jsonl`.

#### `AskAIPanel`

- Triggered by a key binding (e.g., `ctrl+a`) on a PR.
- Full-screen overlay with a scrollable message history and a text input.
- Sends messages via `ACPService.sendPrompt`.
- Streams agent text from `sessionUpdate` `agent_message_chunk` events.
- Input is **disabled** while a `prompt` call is in-flight (the ACP `prompt` method blocks until the agent's turn completes). A "typing…" indicator is shown.
- When the agent's turn completes (PromptResponse received), input is re-enabled.
- `session/cancel` is sent if the user presses `ctrl+c` inside the panel (not process-exit).

#### `PostFindingsModal`

- Triggered by `ctrl+p` from `FindingsPanel`.
- Lists all `accepted`/`modified` findings not yet posted.
- If the PR's current `headRefOid` differs from the stored `head_ref_oid` in any finding, shows a warning: "PR has new commits — line numbers may be stale. Review before posting."
- Confirmation step → for each finding, routes as follows:
  - **Line-anchored finding** (`file_path` + `line_start` present): calls `GitHubService.createPullRequestComment` with:
    - `commitId = finding.headRefOid`
    - `path = finding.filePath`
    - `line = finding.lineEnd ?? finding.lineStart`
    - `startLine = finding.lineStart` (if different from `lineEnd`)
    - `side = finding.diffSide ?? "RIGHT"`
    - `body = finding.modifiedBody ?? finding.body`
  - **PR-level finding** (`file_path` is null): calls `GitHubService.createPullRequestIssueComment` (to be added to `GitHubService`) with just `body`.
- On success: sets `posted_url` in SQLite.

This mapping is covered by a dedicated unit test (see Verification Plan).

---

## Verification Plan

### Unit tests

- `src/mcp/server.ts`: spawn the server in both dev mode (`bun src/standalone.ts mcp-server`) and standalone binary mode, send a valid MCP `tools/call` for `report_finding`, assert `findings.jsonl` is appended with correct JSON. Test invalid input → MCP error response. Test that both invocation modes produce identical output.
- **`findings.jsonl` partial-line handling**: write a file with a partial (no-trailing-newline) last line, run a ReviewWatcher poll cycle, assert the partial line is skipped; write the rest of the line + newline, assert the complete line is processed.
- `CacheService` migration: run `002_review_findings` migration on a temp DB; verify table and index exist; verify `upsertFinding` / `listFindings` / `updateFindingStatus` round-trips.
- **`ReviewFinding` → GitHub posting mapping**: unit test the `PostFindingsModal` posting logic in isolation:
  - Line-anchored finding → `createPullRequestComment` with correct `commitId = headRefOid`, `path`, `line`, `startLine`, `side`.
  - PR-level finding (no `file_path`) → `createPullRequestIssueComment` (mock only).
  - `modified_body` used over `body` when set.
  - Warning shown when `headRefOid` in finding differs from current PR `headRefOid`.
- `ACPService`: mock the opencode subprocess with a fake ACP agent (using the ACP SDK's in-memory transport from tests), assert `startReviewSession` creates a session and the prompt includes expected template fields. Assert process cleanup on `closeSession` kills the child process. Assert that starting a second session for the same PR key returns an error.

### Integration tests

- End-to-end review session: real `ghui mcp-server` subprocess (not mocked), fake ACP agent that immediately calls `report_finding` once then completes. Assert the finding appears in SQLite and the review folder.
- Human comment round-trip: write a human comment via `HumanCommentModal` (simulated), assert it appears in `review_findings` with `source = "human"` and in `human-comments.jsonl`.
- Status transitions: accept → post cycle (mock `GitHubService.createPullRequestComment`), assert `posted_url` is set.
- **Orphan process test**: start an ACP session, kill ghui process (SIGTERM), assert the `opencode acp` child process also terminates.

### Manual smoke test

1. Add a `repoMappings` entry in `~/.config/ghui/ghui.json`.
2. Open ghui, navigate to a PR in that repo.
3. Press `ctrl+r` → confirm → session starts.
4. Observe findings appearing in `FindingsPanel` in real time.
5. Accept one, reject another, edit a third.
6. Press `ctrl+p` → confirm post → verify comment appears on GitHub PR.
7. Press `ctrl+a` → ask a question about the PR → verify streaming response.

---

## Risks / Open Questions

| # | Risk / Question | Severity | Owner |
|---|-----------------|----------|-------|
| 1 | **`opencode acp` availability**: requires opencode installed and on PATH. MCP server also requires `ghui` on PATH from opencode's subprocess environment. If PATH is wrong in the spawned process, MCP fails silently. Need clear error surfacing. | High | Implementation |
| 2 | **`process.execPath` in dev vs standalone**: in dev `bun run`, `process.execPath` is Bun; in standalone binary it's the binary itself. Both routes through `standalone.ts` and must be tested explicitly. | Medium | Implementation |
| 3 | **`.ghui-review/` inside repo**: writing review files into the local repo working tree is an assumption that the directory is writable and acceptable. Repos with strict `.gitignore`-enforcement CI or read-only workspaces may break. Fallback: embed context in initial prompt text. This needs user confirmation. | Medium | **Human decision needed** |
| 4 | **`repoMappings` missing entry**: if the user has not configured the repo, `InitiateReviewModal` should show a helpful error with the exact JSON to add, not a crash. | Medium | Implementation |
| 5 | **ACP SDK version alignment**: `@agentclientprotocol/sdk` must be added to ghui's dependencies. Version must match the protocol version opencode expects. Protocol version is negotiated in `initialize`; mismatch causes a hard error. Check against opencode's lockfile. | Medium | Implementation |
| 6 | **`@modelcontextprotocol/sdk` dependency**: new dependency for the MCP server. Version must be MCP-protocol-compatible with whatever opencode uses to connect to local MCP servers (opencode uses `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`). | Medium | Implementation |
| 7 | **MCP server health from ghui's perspective**: opencode spawns the MCP server, so ghui has no direct process handle. If the MCP server crashes, opencode may or may not surface this clearly. The review session will stall or produce no findings. Mitigation: ghui detects session inactivity (no `sessionUpdate` after N seconds) and shows a timeout warning. | Medium | Implementation |
| 8 | **`headRefOid` staleness on post**: if the PR gains new commits between review and post, the stored `headRefOid` and line numbers may be stale. Warning shown in `PostFindingsModal`; user confirms. Line number validity is GitHub's responsibility after the user confirms. | Low | Implementation |
| 9 | **Key binding conflicts**: key bindings for new features must not conflict with existing bindings. Specifically, `ctrl+c` in `AskAIPanel` is used to cancel the current agent turn (via `session/cancel`), not quit ghui. The panel must intercept this key before it propagates to the outer app. | Low | Implementation |
| 10 | **Config file convention** (previously Risk #6): new `~/.config/ghui/ghui.json`, or stick to env vars for ACP/repo-mapping config? | Low | **Human decision needed** |
| 11 | **Queued reviews plan interaction**: `plans/queued-reviews.md` describes a pending review workflow that's not started. The `PostFindingsModal` posts findings as individual comments, not a formal GitHub Review object. These two features will need reconciliation when queued reviews ships. | Info | Future |
| 12 | **Longer-term: agent list from ACP**: config-only for MVP is agreed; flag as future work. | Info | Future |

---

## Relevant Files / Research References

| File | Key Detail |
|------|-----------|
| `src/standalone.ts:L14–53` | Existing subcommand dispatch pattern for new `mcp-server` subcommand |
| `src/domain.ts:L108–118` | `PullRequestReviewComment` — schema AI findings must match for eventual GitHub post |
| `src/domain.ts:L89–98` | `CreatePullRequestCommentInput` — what `PostFindingsModal` must populate |
| `src/config.ts` | Current env-var config; JSON config file addition goes here |
| `src/services/CacheService.ts` | Effect SQL pattern; new migration and methods added here |
| `_findings/codebase-research-opencode-acp.md` | `opencode acp` CLI, ndjson protocol, tool call event schema |
| `_findings/codebase-research-acp-sdk-api-surface.md` | Full `Client` and `Agent` interfaces; `newSession` MCP server format |
| `_findings/codebase-research-opencode-mcp-integration.md` | `StdioClientTransport` pattern; config format for local MCP servers |
| `_findings/codebase-research-ghui-deep-dive.md` | All domain types, services, state management |
| `plans/sqlite-cache.md` | Existing SQLite stack and migration conventions to follow |

---

## Out of Scope (MVP)

- Fetching the agent list from an ACP session (config-only for now).
- Multiple concurrent ACP sessions per PR.
- Pushing changes to `findings.jsonl` back to GitHub as a formal Review object (only comment-by-comment posting in MVP).
- Rich diff viewer integration (showing findings inline in the existing diff view).
- AI findings from PR-level (non-line-anchored) comments being converted to review comments (they become issue comments instead).
- Authentication / auth flow for ACP (`authenticate` method).

---

## New GitHubService method

`GitHubService` needs one new method for PR-level (non-line-anchored) findings:

```typescript
createPullRequestIssueComment(input: {
  repository: string
  number: number
  body: string
}): Effect<{ id: string; url: string }, GitHubError>
```

This shells out to `gh api repos/{owner}/{repo}/issues/{number}/comments -f body={body}` (issue comments endpoint, which works for PR issue comments).

---

## Open Questions for Human Signoff

1. **`.ghui-review/` folder inside repo** (Risk #3): Is writing review context files into `.ghui-review/<pr-number>/` inside the checked-out repo acceptable, or should we use a directory fully outside the repo and embed context in the initial prompt instead?
2. **Config file convention** (Risk #10): new `~/.config/ghui/ghui.json` file, or stick to env vars for ACP/repo-mapping config?
3. **`requestPermission` handling**: auto-allow file reads and in-`--cwd` tool calls in MVP, or surface all permission requests to the user?
4. **Key bindings**: what key bindings are acceptable for "initiate review", "ask AI", "human comment", "post findings"?
