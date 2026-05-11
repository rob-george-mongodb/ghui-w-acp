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
| `src/config.ts` | Three env-var settings (`GHUI_PR_FETCH_LIMIT`, `GHUI_PR_PAGE_SIZE`, `GHUI_CACHE_PATH`). Must be extended to load from a JSON config file. |
| `src/domain.ts` | All domain types. `PullRequestItem` (L134–156) is the central type. `PullRequestReviewComment` (L108–118) and `CreatePullRequestCommentInput` (L89–98) define what goes to GitHub. |
| `src/services/CacheService.ts` | Effect-based SQLite cache. Uses `@effect/sql-sqlite-bun` with WAL enabled, semaphore-serialised writes, and migration-based schema. New tables added here. |
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
│  InitiateReviewModal ──► ACPService ──── WorktreeService             │
│                                │          (git worktree add/remove)   │
│  FindingsPanel        ◄── file watcher ◄── .ghui-review/ in worktree │
│                                │                                      │
│  ACPService ──────────────────►CacheService (SQLite)                  │
│  AskAIPanel ──────────────────►ACPService                             │
└──────────────────────────────────────────────────────────────────────┘
         │ spawns (opencode acp --cwd <worktree-path>)
         │ OR attaches to extant opencode acp process (future)
         ▼
┌─────────────────────────┐     ┌───────────────────────────────────────┐
│   opencode acp          │────►│  ghui mcp-server  (subprocess)        │
│   (ACP agent process)   │ MCP │  • exposes report_finding tool         │
│   ACP ndjson over stdio │     │  • appends to .ghui-review/findings.jsonl │
└─────────────────────────┘     └───────────────────────────────────────┘
         │ ACP ndjson (stdin/stdout)
ghui ClientSideConnection
  • sessionUpdate → stream agent text to AskAIPanel / progress
  • requestPermission → auto-allow reads; surface others to user
```

### Worktree as the agent's working directory

When a PR review is initiated, ghui creates a **git worktree** for the PR branch. This worktree becomes the `--cwd` for `opencode acp`, giving the agent access to the **full repository codebase** for that branch. The agent uses opencode's built-in `read`, `glob`, `grep`, and terminal tools to explore the code directly — no pre-generated diff or context file needed.

A `.ghui-review/` subfolder within the worktree holds ghui-specific files:

```
<worktreeRoot>/<owner>/<repo>/<pr-number>/          ← git worktree (full repo)
├── ... (all repo files at the PR branch HEAD) ...
└── .ghui-review/
    ├── findings.jsonl        ← appended by MCP server; read by ghui watcher
    ├── report.json           ← written by submit_pr_report tool (last call wins per session)
    └── human-comments.jsonl  ← written by ghui for human draft comments
```

The agent is told about `.ghui-review/findings.jsonl` in the initial prompt so it can check previously reported findings and avoid duplicates.

### Data flow for "AI findings"

1. ghui creates a git worktree for the PR branch at `<worktreeRoot>/<owner>/<repo>/<pr-number>/`.
2. ghui creates `.ghui-review/` inside the worktree.
3. ghui spawns `opencode acp --cwd <worktree-path>`.
4. ghui calls `newSession({ mcpServers: [{ name: "ghui-review", command: <ghui-binary>, args: ["mcp-server"], env: [...] }] })`.
5. Agent explores the codebase using its own tools, calls `report_finding` for significant issues.
6. `ghui mcp-server` appends each finding as a JSON line to `<worktree>/.ghui-review/findings.jsonl`.
7. ghui's file watcher imports new lines into SQLite and updates the `FindingsPanel` atoms in real time.
8. When the session completes, ghui performs a final sweep of `findings.jsonl`.

### Data flow for "ask AI" (Q&A session)

1. User opens `AskAIPanel` on a PR (key binding chosen during implementation).
2. If no worktree exists yet for this PR, ghui creates one (same as step 1 above).
3. ghui spawns a new `opencode acp` session (same MCP server, so `report_finding` is available in Q&A too).
4. ghui sends the initial context prompt (PR metadata + `.ghui-review/` path).
5. User types questions; ghui sends them via `session/prompt`.
6. Agent text streams back via `sessionUpdate` `agent_message_chunk` → shown in `AskAIPanel`.
7. Any `report_finding` calls during Q&A are handled identically to review session calls.

---

## Proposed Changes

### 1. `ghui mcp-server` subcommand

**File**: `src/standalone.ts`

Add `"mcp-server"` to the recognised commands list and dispatch to `src/mcp/server.ts` before the TUI fallthrough. The `process.execPath` trick (using the same binary for both TUI and MCP server modes) works in both dev (`bun run` → execPath is Bun, routes through updated `standalone.ts`) and standalone binary modes. Both modes must be explicitly tested.

**File**: `src/mcp/server.ts` (new)

A minimal MCP server using `@modelcontextprotocol/sdk/server/` over stdio. Registers **two tools**:

**Tool 1: `report_finding`**

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

On each call: generates a UUID, appends a JSON line to `$GHUI_REVIEW_DIR/findings.jsonl` (single `write` syscall), returns `{ id, status: "recorded" }`.

**Tool 2: `submit_pr_report`**

```typescript
{
  name: "submit_pr_report",
  description: "Submit a full PR review report with an overall verdict.",
  inputSchema: {
    type: "object",
    properties: {
      report: {
        type: "string",
        description: "Full review report in Markdown. Should summarise the PR's purpose, key findings, and reasoning for the verdict.",
      },
      verdict: {
        type: "string",
        enum: ["indeterminate_human_review_required", "good_for_merge", "block_merge", "minor_issues"],
        description: "Overall assessment of the PR.",
      },
    },
    required: ["report", "verdict"],
  },
}
```

On call: writes `$GHUI_REVIEW_DIR/report.json` (containing `{ verdict, report, sessionId, submittedAt }`) to disk, upserts a row in `review_reports` SQLite table. Returns `{ status: "submitted" }`. Multiple calls overwrite the previous report for this session.

If `JSON.parse` fails on any line read by the watcher, that line is skipped and retried — never crash, never stop watching.

Environment variables consumed: `GHUI_REVIEW_DIR`, `GHUI_PR_KEY`, `GHUI_SESSION_ID`.

### 2. Config extension

**File**: `src/config.ts` (extend)

Add a JSON config file at `${XDG_CONFIG_HOME:-~/.config}/ghui/ghui.json`. Env vars continue to work for existing settings; the JSON file adds new sections. Missing file = use defaults. Parse error = warn and continue with defaults (never crash).

```typescript
interface GhuiJsonConfig {
  /**
   * Map of "owner/repo" → absolute path to the local git clone.
   * Required for any ACP review feature. The clone is used as the
   * base for git worktree creation.
   */
  repoMappings?: Record<string, string>

  acp?: {
    agents: Array<{
      name: string
      /** Command array to spawn, e.g. ["opencode", "acp"] */
      command: string[]
      defaultModel?: string
    }>
    defaultAgent?: string
  }

  /**
   * Root directory under which git worktrees are created for reviews.
   * Default: ${XDG_DATA_HOME:-~/.local/share}/ghui/worktrees
   * Structure: <worktreeRoot>/<owner>/<repo>/<pr-number>/
   */
  worktreeRoot?: string
}
```

### 3. Worktree management

**File**: `src/services/WorktreeService.ts` (new)

Manages git worktrees for PR reviews. Responsibilities:

- **Create**: `git worktree add <worktreeRoot>/<owner>/<repo>/<pr-number>/ <branch>` from the base repo path (`repoMappings[repo]`).
- **Remove**: `git worktree remove --force <path>` when the user closes a review.
- **List**: query SQLite `review_worktrees` table for all tracked worktrees.
- **Prune stale**: on startup, check worktrees for PRs that are merged/closed and prompt cleanup.

If the PR branch does not exist locally, try `git fetch origin <branch>` first.

### 4. SQLite schema additions

New migration in `CacheService` migrations record:

```sql
-- Migration: 002_acp_review

-- Tracks git worktrees created for PR reviews
CREATE TABLE IF NOT EXISTS review_worktrees (
  pr_key        TEXT NOT NULL PRIMARY KEY,   -- "<owner>/<repo>#<number>"
  worktree_path TEXT NOT NULL,
  branch_name   TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- Tracks every ACP session created for a PR review (review or chat).
-- Multiple sessions per PR are tracked here; MVP enforces one active at a time
-- but the history is always kept. Stretch goal: allow multiple concurrent sessions.
CREATE TABLE IF NOT EXISTS review_sessions (
  session_id    TEXT NOT NULL PRIMARY KEY,   -- ACP-assigned session ID from newSession response
  pr_key        TEXT NOT NULL,
  session_type  TEXT NOT NULL CHECK (session_type IN ('review', 'chat')),
  agent_name    TEXT NOT NULL,               -- from config acp.agents[n].name
  started_at    TEXT NOT NULL,
  ended_at      TEXT,                        -- NULL while session is active
  stop_reason   TEXT                         -- from PromptResponse.stopReason
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_pr_key
  ON review_sessions (pr_key);

-- Stores full-report submissions from submit_pr_report tool.
-- One row per session (last call wins within a session).
-- Not yet surfaced in the app UI but stored for future use.
CREATE TABLE IF NOT EXISTS review_reports (
  session_id    TEXT NOT NULL PRIMARY KEY,
  pr_key        TEXT NOT NULL,
  verdict       TEXT NOT NULL CHECK (verdict IN (
                  'indeterminate_human_review_required',
                  'good_for_merge',
                  'block_merge',
                  'minor_issues'
                )),
  report_md     TEXT NOT NULL,               -- full Markdown report
  submitted_at  TEXT NOT NULL
);

-- Tracks all local draft comments: AI findings and human-authored drafts.
-- Neither source goes to GitHub without an explicit user action.
CREATE TABLE IF NOT EXISTS review_findings (
  id            TEXT NOT NULL PRIMARY KEY,
  pr_key        TEXT NOT NULL,     -- "<owner>/<repo>#<number>"
  session_id    TEXT,              -- FK → review_sessions.session_id; NULL for human-authored
  head_ref_oid  TEXT NOT NULL,     -- PR commit SHA at review time; used as commitId when posting
  source        TEXT NOT NULL CHECK (source IN ('ai', 'human')),
  file_path     TEXT,              -- NULL = PR-level comment (→ issue comment when posted)
  line_start    INTEGER,
  line_end      INTEGER,
  diff_side     TEXT CHECK (diff_side IN ('LEFT', 'RIGHT')),  -- NULL for PR-level
  title         TEXT,
  body          TEXT NOT NULL,
  severity      TEXT CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
  status        TEXT NOT NULL DEFAULT 'pending_review'
                CHECK (status IN ('pending_review', 'accepted', 'rejected', 'modified')),
  modified_body TEXT,              -- user-edited body; overrides body when posting
  posted_url    TEXT,              -- GitHub URL after posting; NULL = not yet posted
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_findings_pr_key
  ON review_findings (pr_key);
```

**`session_id` in `review_findings`**: references the `review_sessions` table. Every AI finding is tagged with the session that produced it, enabling attribution across multiple sessions on the same PR.

**`head_ref_oid`**: Captures the commit SHA at review time. Used as `commitId` in `createPullRequestComment`. If the PR has new commits since the review, `PostFindingsModal` shows a staleness warning.

**`diff_side`**: Required by `CreatePullRequestCommentInput`. Defaults to `"RIGHT"` (new-file side, correct for additions/changes) if the agent omits it.

New `CacheService` methods:

```typescript
// Worktrees
readonly upsertWorktree:   (entry: ReviewWorktree) => Effect<void, never>
readonly listWorktrees:    () => Effect<readonly ReviewWorktree[], CacheError>
readonly deleteWorktree:   (prKey: string) => Effect<void, never>

// Sessions
readonly upsertSession:    (session: ReviewSession) => Effect<void, never>
readonly endSession:       (sessionId: string, endedAt: Date, stopReason?: string) => Effect<void, never>
readonly listSessions:     (prKey: string) => Effect<readonly ReviewSession[], CacheError>

// Reports
readonly upsertReport:     (report: ReviewReport) => Effect<void, never>
readonly getReport:        (sessionId: string) => Effect<ReviewReport | null, CacheError>

// Findings
readonly upsertFinding:        (finding: ReviewFinding) => Effect<void, never>
readonly listFindings:         (prKey: string) => Effect<readonly ReviewFinding[], CacheError>
readonly updateFindingStatus:  (id: string, status: FindingStatus, modifiedBody?: string) => Effect<void, never>
readonly markFindingPosted:    (id: string, url: string) => Effect<void, never>
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

export const reviewVerdicts = [
  "indeterminate_human_review_required",
  "good_for_merge",
  "block_merge",
  "minor_issues",
] as const
export type ReviewVerdict = (typeof reviewVerdicts)[number]

export const reviewSessionTypes = ["review", "chat"] as const
export type ReviewSessionType = (typeof reviewSessionTypes)[number]

export interface ReviewFinding {
  readonly id: string
  readonly prKey: string
  readonly sessionId: string | null  // null for human-authored
  readonly headRefOid: string
  readonly source: FindingSource
  readonly filePath: string | null
  readonly lineStart: number | null
  readonly lineEnd: number | null
  readonly diffSide: DiffCommentSide | null
  readonly title: string | null
  readonly body: string
  readonly severity: FindingSeverity | null
  readonly status: FindingStatus
  readonly modifiedBody: string | null
  readonly postedUrl: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface ReviewSession {
  readonly sessionId: string   // ACP-assigned ID from newSession response
  readonly prKey: string
  readonly sessionType: ReviewSessionType
  readonly agentName: string
  readonly startedAt: Date
  readonly endedAt: Date | null
  readonly stopReason: string | null
}

export interface ReviewReport {
  readonly sessionId: string
  readonly prKey: string
  readonly verdict: ReviewVerdict
  readonly reportMd: string
  readonly submittedAt: Date
}

export interface ReviewWorktree {
  readonly prKey: string
  readonly worktreePath: string
  readonly branchName: string
  readonly createdAt: Date
}
```

### 6. ACP service layer

**File**: `src/services/ACPService.ts` (new)

Wraps `@agentclientprotocol/sdk`'s `ClientSideConnection`. Responsibilities:

- **Spawn** `opencode acp --cwd <worktreePath>` as a child process. The worktree is always created by `WorktreeService` before the ACP session starts.
- **Future**: support attaching to an already-running `opencode acp` process (e.g., if opencode gains a socket transport). MVP always spawns fresh.
- Construct ndjson stream from the process's stdin/stdout.
- Implement the `Client` interface:
  - `sessionUpdate`: push to an Effect Queue; TUI atoms subscribe to this.
  - `requestPermission`: auto-allow file reads; surface all other requests to the user via `PermissionRequestModal`.
- **Session ID tracking**: when `newSession` responds, the ACP-assigned `sessionId` is immediately persisted via `CacheService.upsertSession`. This ID is then included in the `GHUI_SESSION_ID` env var passed to the MCP server, so findings and reports carry the correct session attribution. `endSession` is called (with `stopReason`) when `prompt` returns.
- **Process lifecycle**: track spawned child processes. On ghui exit (SIGTERM, SIGINT, `process.on('exit')`), SIGTERM all tracked children. `closeSession` kills only that session's process.
- **One active session per PR** in MVP (review or chat). `startReviewSession` / `startChatSession` return an error if an active (not yet ended) session already exists for that PR key.
- **Stretch goal — multiple sessions per PR**: the `review_sessions` table already supports N sessions per PR. Future work can relax the "one active" constraint to allow, e.g., a review session and a chat session to run concurrently, or multiple review sessions with different agents.

Expose Effect-friendly API:

```typescript
readonly startReviewSession: (pr: PullRequestItem, worktreePath: string) => Effect<ReviewSession, ACPError>
readonly startChatSession:   (pr: PullRequestItem, worktreePath: string) => Effect<ReviewSession, ACPError>
readonly sendPrompt:         (sessionId: string, text: string) => Effect<PromptResponse, ACPError>
readonly cancelSession:      (sessionId: string) => Effect<void, never>
readonly closeSession:       (sessionId: string) => Effect<void, never>
```

The return type is `ReviewSession` (not just `SessionId`), containing the ACP-assigned `sessionId` alongside the ghui metadata, so callers always have the full record.

The MCP server registration passed in `newSession`:

```typescript
mcpServers: [{
  name: "ghui-review",
  command: process.execPath,
  args: ["mcp-server"],
  env: [
    { name: "GHUI_REVIEW_DIR",  value: `${worktreePath}/.ghui-review` },
    { name: "GHUI_PR_KEY",      value: prKey },
    { name: "GHUI_SESSION_ID",  value: acp_session_id },  // filled after newSession responds
  ],
}]
```

> **Note**: `GHUI_SESSION_ID` is only known after `newSession` returns. The MCP server subprocess is spawned by opencode after `newSession` completes, so the env var is available in time. The env array passed to `newSession` is constructed with the session ID immediately upon receiving the `NewSessionResponse`.

**Initial review prompt template** (sent as the first `session/prompt`):

```
You are reviewing a GitHub pull request.

Repository: <owner>/<repo>
PR: #<number> — <title>
Branch: <headRefName>
Author: <author>
Labels: <labels>
Stats: +<additions> -<deletions> across <changedFiles> files
URL: <url>

Description:
<body>

The full repository at the PR branch HEAD is your working directory.
Previously reported findings are at: .ghui-review/findings.jsonl

Review the pull request. For each significant finding that warrants a PR comment,
call `report_finding`. Focus on correctness, security, performance, and API design.
Omit trivial style issues unless they violate explicit project conventions.

When your review is complete, call `submit_pr_report` with a full Markdown summary
and one of the verdict values: indeterminate_human_review_required | good_for_merge |
block_merge | minor_issues.
```

### 7. File watcher

**File**: `src/services/ReviewWatcher.ts` (new)

Uses `Bun.file` + polling at 500 ms to detect new complete lines in `findings.jsonl`. Tracks the last byte offset read to avoid re-processing.

**Partial-line safety**: reads only up to the last `\n` in each poll cycle. Any trailing bytes (potentially a partial write) are left for the next cycle. Each line is independently `JSON.parse`d; parse failures log a warning and are skipped — never crash, never stop watching.

**Final sweep**: triggered by `ACPService` immediately after `session/prompt` returns. Since `prompt` blocks until the agent turn completes, and MCP tool calls return before the agent finishes, all `report_finding` writes have completed by this point. The watcher reads from its last offset to end-of-file, then tears down.

### 8. New `GitHubService` method

`GitHubService` needs one new method for PR-level (non-line-anchored) findings:

```typescript
createPullRequestIssueComment(input: {
  repository: string
  number: number
  body: string
}): Effect<{ id: string; url: string }, GitHubError>
```

Shells out to `gh api repos/{owner}/{repo}/issues/{number}/comments --method POST -f body={body}`.

### 9. UI additions

All new UI follows existing Ink + `jotai-effect` atom patterns from `src/App.tsx`. Key bindings are chosen during implementation to avoid conflicts with the existing keymap (`src/keyboard/` + `src/keymap/`). Suggested candidates: `r` for initiate review, `a` for ask AI, `w` for write human comment, `p` for post findings — all checked against the existing keymap before use.

#### `InitiateReviewModal`

- Triggered on a selected PR.
- Shows: PR title, selected agent (from config), worktree path that will be created.
- Error with instructional message if `repoMappings` has no entry for this repo.
- Confirm → `WorktreeService.create(pr)` → `ACPService.startReviewSession(pr, worktreePath)`.

#### `FindingsPanel` (in-PR view section)

- Shown when a PR has any entries in `review_findings` (AI or human, any status).
- Lists findings grouped by source, then status.
- Each row: severity badge, title, file:line (if present), status.
- Per-finding actions: accept, reject, edit (`FindingEditModal`).
- Panel-level action: post all accepted/modified to GitHub (`PostFindingsModal`).

#### `FindingEditModal`

- Editable textarea pre-filled with `body`.
- Save → `status = "modified"`, `modifiedBody` set.

#### `HumanCommentModal`

- Human drafts a local comment: optional `file_path`, `line_start`, `line_end`, and required `body`.
- Saved as `source = "human"` in `review_findings` and appended to `.ghui-review/human-comments.jsonl`.
- These never go to GitHub without the `PostFindingsModal` step.

#### `AskAIPanel`

- Full-screen overlay with scrollable message history and text input.
- Sends messages via `ACPService.sendPrompt`.
- Input **disabled** while a `prompt` is in-flight; shows "Thinking…" indicator.
- `session/cancel` sent if user cancels within the panel.
- Any `report_finding` calls during Q&A appear in `FindingsPanel` identically to review-session findings.

#### `PostFindingsModal`

- Lists all `accepted`/`modified` findings not yet posted.
- If any finding's `headRefOid` differs from the current PR's `headRefOid`, shows: "PR has new commits — line numbers may be stale. Review carefully before posting."
- Posts each finding:
  - **Line-anchored** (`file_path` + `line_start` present): calls `GitHubService.createPullRequestComment` with `commitId = finding.headRefOid`, `path`, `line = lineEnd ?? lineStart`, `startLine` (if differs from `lineEnd`), `side = diffSide ?? "RIGHT"`, `body = modifiedBody ?? body`.
  - **PR-level** (`file_path` null): calls `GitHubService.createPullRequestIssueComment`.
- On success: sets `posted_url` in SQLite.

#### `PermissionRequestModal`

- Shown when `requestPermission` fires for non-read operations.
- Displays the tool name, kind, and any locations.
- Options: "Allow once", "Reject".

---

## Verification Plan

### Unit tests

- `src/mcp/server.ts`:
  - `report_finding`: spawn in both dev and standalone modes, send valid `tools/call`, assert `findings.jsonl` appended with correct JSON and UUID. Test invalid input → MCP error. Both modes produce identical output.
  - `submit_pr_report`: send valid call, assert `report.json` written with `{ verdict, report, sessionId, submittedAt }`. Assert SQLite `review_reports` row upserted. Second call overwrites previous.
  - `GHUI_SESSION_ID` env var is present in the written `report.json`.
- **Partial-line safety**: write a file with a partial last line, run a poll cycle, assert skip; complete the line, assert processed on next cycle.
- `CacheService` migration `002_acp_review`: all four tables and indexes exist; round-trip all new methods (`upsertWorktree`, `upsertSession`, `endSession`, `listSessions`, `upsertReport`, `getReport`, `upsertFinding`, `listFindings`, `updateFindingStatus`, `markFindingPosted`).
- **`ReviewFinding` → GitHub posting mapping**: line-anchored → correct `createPullRequestComment` args. PR-level → `createPullRequestIssueComment`. `modifiedBody` over `body`. Staleness warning when finding `headRefOid ≠ current PR headRefOid`.
- `ACPService` (in-memory transport): `startReviewSession` persists a `ReviewSession` row with the ACP-assigned `sessionId`. `endSession` is called on `prompt` return. Second `startReviewSession` for same PR key while first is active returns error. Process cleanup on `closeSession`.

### Integration tests

- End-to-end review session: real `ghui mcp-server`, fake ACP agent that calls `report_finding` once and `submit_pr_report` once then completes. Assert finding in SQLite + `findings.jsonl`; assert report in SQLite + `report.json`.
- Human comment round-trip: `source = "human"` in SQLite, appended to `human-comments.jsonl`.
- Status transitions: accept → post cycle (mock `GitHubService`), assert `posted_url` set.
- Orphan process: SIGTERM ghui, assert `opencode acp` child terminates.
- Worktree lifecycle: `WorktreeService.create` → `git worktree add` invoked, row in SQLite. `WorktreeService.remove` → `git worktree remove` invoked, row deleted.

### Manual smoke test

1. Add `repoMappings` and `acp.agents` to `~/.config/ghui/ghui.json`.
2. Open ghui, navigate to a PR in that repo.
3. Trigger "initiate review" → confirm → worktree created → session starts.
4. Observe findings appearing in `FindingsPanel` in real time.
5. Accept one, reject another, edit a third.
6. Trigger "post findings" → confirm → verify comments appear on GitHub PR.
7. Trigger "ask AI" → type a question → verify streaming response.

---

## Risks / Open Questions

| # | Risk / Question | Severity | Owner |
|---|-----------------|----------|-------|
| 1 | **`opencode acp` on PATH**: must be findable in the spawned process environment. MCP server also needs `ghui` (or Bun + standalone.ts path) on PATH. Clear error on missing binary. | High | Implementation |
| 2 | **Worktree creation may fail**: branch not fetched locally, disk full, permissions, repo not a git repo. `WorktreeService` must surface actionable errors in the TUI. | High | Implementation |
| 3 | **`process.execPath` in dev vs standalone**: dev = Bun binary, standalone = ghui binary. Both correctly route through updated `standalone.ts`. Must be tested explicitly in CI. | Medium | Implementation |
| 4 | **ACP SDK version alignment**: `@agentclientprotocol/sdk` added as ghui dependency. Version must be protocol-compatible with opencode's version. Check opencode's lockfile; protocol version mismatch in `initialize` is a hard error. | Medium | Implementation |
| 5 | **`@modelcontextprotocol/sdk` dependency**: new dependency for the MCP server. Version must be MCP-protocol-compatible with what opencode uses to connect to local MCP servers (`StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`). | Medium | Implementation |
| 6 | **MCP server health**: opencode spawns the MCP server subprocess; ghui has no direct handle. MCP crash = no findings, no error in TUI. Mitigation: inactivity timeout in `ACPService` (no `sessionUpdate` for >N seconds → warning). | Medium | Implementation |
| 7 | **Worktree size and disk**: each worktree is a full checkout. Large repos will use significant disk. `WorktreeService` should show disk usage and support manual cleanup from the TUI. | Medium | Implementation |
| 8 | **`headRefOid` staleness on post**: warning shown in `PostFindingsModal` if the PR has new commits since the review. User confirms. Line validity is GitHub's concern post-confirmation. | Low | Implementation |
| 9 | **`repoMappings` missing entry**: `InitiateReviewModal` shows a helpful error with the exact JSON snippet to add. Never crash. | Low | Implementation |
| 10 | **Attaching to extant opencode acp process**: supported in future if opencode gains a socket/HTTP transport. MVP always spawns fresh. Noted for implementer. | Info | Future |
| 11 | **Queued reviews plan interaction**: `plans/queued-reviews.md` not yet started. `PostFindingsModal` posts individual comments, not a formal GitHub Review object. These will need reconciliation when queued reviews ships. | Info | Future |

---

## Relevant Files / Research References

| File | Key Detail |
|------|-----------|
| `src/standalone.ts:L14–53` | Existing subcommand dispatch pattern for new `mcp-server` subcommand |
| `src/domain.ts:L108–118` | `PullRequestReviewComment` — schema AI findings must match for GitHub post |
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

- Attaching to an already-running `opencode acp` process.
- Multiple concurrent ACP sessions per PR.
- Agent list fetched from ACP (config-only for now).
- Rich diff viewer integration (findings shown inline in the diff view).
- Formal GitHub Review object submission (individual comments only via `PostFindingsModal`).
- ACP `authenticate` flow.
- Automatic worktree cleanup for merged/closed PRs (manual cleanup only in MVP).
