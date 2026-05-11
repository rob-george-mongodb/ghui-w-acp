# Codebase Research: ghui Architecture

## Research Question
Full architectural survey of ghui (`@kitlangton/ghui`) — domain model, database, config, services, UI components, PR review flow, existing plans, and any ACP-related code.

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `src/domain.ts` | 1 | All domain types |
| 2 | Read `src/config.ts` | 1 | Config with env vars |
| 3 | Read `src/services/` directory | 6 files | All services |
| 4 | Read `src/ui/` directory | 18 files | All UI components |
| 5 | `grep "acp\|ACP\|ghui-w-acp"` | 1 | Only `.git` worktree pointer |
| 6 | Read `plans/` directory | 7 files | Feature plans |
| 7 | Read `src/App.tsx` (1019 lines of ~2500+) | 1 | Massive monolith component |
| 8 | Read `src/pullRequestCache.ts` | 1 | Detail merge logic |

## Package Identity
- **Name**: `@kitlangton/ghui` v0.7.1
- **Description**: Terminal UI for GitHub pull requests
- **Runtime**: Bun
- **Framework**: Effect (4.0.0-beta.59) + `@opentui/react` + `@effect/atom-react`
- **Upstream repo**: `kitlangton/ghui`
- **Worktree origin**: `.git` points to `/Users/rob.george/git/i_hate_github/ghui-w-acp/.git/worktrees/mighty-rocket`

## Domain Model (src/domain.ts, L1-183)

### Enums / Literal Unions

| Type | Values | Line |
|------|--------|------|
| `PullRequestState` | `"open" \| "closed" \| "merged"` | L5-6 |
| `PullRequestUserQueueMode` | `"authored" \| "review" \| "assigned" \| "mentioned"` | L8-9 |
| `PullRequestQueueMode` | `"repository" \| PullRequestUserQueueMode` | L10 |
| `CheckConclusion` | `"success" \| "failure" \| "neutral" \| "skipped" \| "cancelled" \| "timed_out"` | L32-33 |
| `CheckRunStatus` | `"completed" \| "in_progress" \| "queued" \| "pending"` | L35-36 |
| `CheckRollupStatus` | `"passing" \| "pending" \| "failing" \| "none"` | L38-39 |
| `ReviewStatus` | `"draft" \| "approved" \| "changes" \| "review" \| "none"` | L41-42 |
| `Mergeable` | `"mergeable" \| "conflicting" \| "unknown"` | L44 |
| `DiffCommentSide` | `"LEFT" \| "RIGHT"` (Effect Schema) | L48-49 |
| `PullRequestMergeMethod` | `"squash" \| "merge" \| "rebase"` | L51-52 |
| `PullRequestMergeKind` | `"now" \| "auto" \| "admin" \| "disable-auto"` | L54-55 |
| `PullRequestReviewEvent` | `"COMMENT" \| "APPROVE" \| "REQUEST_CHANGES"` | L75-76 |

### Core Interfaces

**`PullRequestItem`** (L134-156) — the main PR data object:
```
repository, author, headRefOid, headRefName, number, title, body,
labels: PullRequestLabel[], additions, deletions, changedFiles,
state: PullRequestState, reviewStatus: ReviewStatus,
checkStatus: CheckRollupStatus, checkSummary: string|null,
checks: CheckItem[], autoMergeEnabled: boolean, detailLoaded: boolean,
createdAt: Date, closedAt: Date|null, url: string
```

**`PullRequestPage`** (L158-162): `items: PullRequestItem[], endCursor, hasNextPage`

**`PullRequestMergeInfo`** (L171-182): Merge-specific view with `mergeable`, `viewerCanMergeAsAdmin`, `isDraft`

**`PullRequestReviewComment`** (L108-118): `id, path, line, side, author, body, createdAt, url, inReplyTo`

**`PullRequestComment`** (L120-132): Tagged union — `"comment"` (issue comment) or `"review-comment"` (extends PullRequestReviewComment)

**`CreatePullRequestCommentInput`** (L89-99): `repository, number, commitId, path, line, side, startLine?, startSide?, body`

**`SubmitPullRequestReviewInput`** (L101-106): `repository, number, event, body`

**Other**: `CheckItem` (L78-82), `PullRequestLabel` (L84-87), `RepositoryMergeMethods` (L67-71), `PullRequestMergeAction` (L58-65), `ListPullRequestPageInput` (L164-169)

### Helper Functions
- `pullRequestQueueSearchQualifier(mode, repository)` — builds GitHub search qualifier string (L20-30)
- `allowedMergeMethodList(allowed)` — filters merge methods by repo config (L73)

## Config (src/config.ts, L1-27)

Eagerly resolved at import time via `Effect.runSync`:

| Key | Env Var | Default | Notes |
|-----|---------|---------|-------|
| `prFetchLimit` | `GHUI_PR_FETCH_LIMIT` | 200 | Max PRs to fetch across pages |
| `prPageSize` | `GHUI_PR_PAGE_SIZE` | 50 | Per-page size, capped at 100 |
| `cachePath` | `GHUI_CACHE_PATH` | `~/.cache/ghui/cache.sqlite` | Set to `"off"/"0"/"false"` to disable |

Cache path uses `XDG_CACHE_HOME` if set, else `~/.cache`.

## Database / SQLite Cache (src/services/CacheService.ts, L1-413)

### Schema (migration `001_initial_cache_schema`, L192-217)

**Table `pull_requests`**:
```sql
pr_key TEXT PRIMARY KEY,        -- "owner/repo#number"
repository TEXT NOT NULL,
number INTEGER NOT NULL,
url TEXT NOT NULL,
head_ref_oid TEXT NOT NULL,
state TEXT NOT NULL,
detail_loaded INTEGER NOT NULL,
data_json TEXT NOT NULL,         -- JSON-serialized PullRequestItem
updated_at TEXT NOT NULL
```
Index: `(repository, number)`

**Table `queue_snapshots`**:
```sql
viewer TEXT NOT NULL,
view_key TEXT NOT NULL,          -- viewCacheKey(view) e.g. "authored", "review", "repository:owner/repo"
view_json TEXT NOT NULL,         -- JSON-serialized PullRequestView
pr_keys_json TEXT NOT NULL,      -- JSON array of pr_key strings (ordered)
fetched_at TEXT NOT NULL,
end_cursor TEXT,
has_next_page INTEGER NOT NULL,
PRIMARY KEY (viewer, view_key)
```

### CacheService Interface (L365-373)
- `readQueue(viewer, view)` → `PullRequestLoad | null`
- `writeQueue(viewer, load)` → void
- `readPullRequest(key)` → `PullRequestItem | null`
- `upsertPullRequest(pr)` → void
- `prune()` → void (deletes entries older than 30 days)

### Layers
- `CacheService.disabledLayer` — no-op, returns nulls (L375-384)
- `CacheService.layerSqlite` — requires `SqlClient.SqlClient` in context (L386-392)
- `CacheService.layerSqliteFile(filename)` — creates dir, opens SQLite, runs migrations, applies pragmas (L394-409)
- `CacheService.layerFromPath(filename | null)` — dispatches to disabled or file layer with fallback (L411-412)

### Pragmas (L183-190)
`synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`, `temp_store=MEMORY`, `journal_size_limit=16MB`

## Services Architecture (src/services/)

### CommandRunner (CommandRunner.ts, L1-99)
- Wraps `Bun.spawn` for CLI execution
- `run(command, args)` → `CommandResult`
- `runSchema(schema, command, args)` → parsed+validated output
- Error types: `CommandError`, `JsonParseError`

### GitHubService (GitHubService.ts, L1-968)
All GitHub interaction goes through `gh` CLI (not direct HTTP). Uses GraphQL via `gh api graphql` and REST via `gh api`.

**Methods** (L581-608):
- `listOpenPullRequests`, `listOpenPullRequestPage`, `listOpenPullRequestDetails` — PR list queries
- `getPullRequestDetails` — single PR detail (GraphQL)
- `getAuthenticatedUser` — `gh api user`
- `getPullRequestDiff` — REST `/pulls/{n}/files`, reconstructed into unified diff
- `listPullRequestReviewComments`, `listPullRequestComments` — REST, combines issue+review comments
- `getPullRequestMergeInfo`, `getRepositoryMergeMethods` — merge readiness
- `mergePullRequest`, `closePullRequest` — `gh pr merge/close`
- `createPullRequestComment`, `createPullRequestIssueComment`, `replyToReviewComment` — comment creation
- `editPullRequestIssueComment`, `editReviewComment` — comment editing
- `deletePullRequestIssueComment`, `deleteReviewComment` — comment deletion
- `submitPullRequestReview` — `gh pr review`
- `toggleDraftStatus` — `gh pr ready`
- `listRepoLabels`, `addPullRequestLabel`, `removePullRequestLabel` — label management

### Other Services
- **BrowserOpener** (BrowserOpener.ts) — opens URLs in browser
- **Clipboard** (Clipboard.ts) — clipboard copy
- **MockGitHubService** (MockGitHubService.ts) — mock for dev/testing, activated by `GHUI_MOCK_PR_COUNT` env var

## PR Review Flow

### Views (src/pullRequestViews.ts, L1-42)
`PullRequestView` is a tagged union:
- `{ _tag: "Repository", repository: string }` — repo-scoped PR list
- `{ _tag: "Queue", mode: PullRequestUserQueueMode, repository: string | null }` — user queue (authored/review/assigned/mentioned)

Key helpers: `viewMode`, `viewCacheKey`, `viewEquals`, `nextView`, `viewLabel`, `parseRepositoryInput`

### Load State (src/pullRequestLoad.ts, L1-10)
```ts
interface PullRequestLoad {
  view: PullRequestView
  data: readonly PullRequestItem[]
  fetchedAt: Date | null
  endCursor: string | null
  hasNextPage: boolean
}
```

### Cache Merge (src/pullRequestCache.ts, L1-19)
`mergeCachedDetails(fresh, cached)` — preserves `body`, `labels`, `additions`, `deletions`, `changedFiles`, `detailLoaded` from cached items when `headRefOid` matches.

### App.tsx State Management (src/App.tsx)
Massive single component (~2500+ lines). Key atoms:
- `pullRequestsAtom` (L284-343) — main data fetch atom, reads cache first, then fetches from GitHub, writes back to cache
- `activeViewAtom` — current queue/repo view
- `queueLoadCacheAtom` — in-memory cache of loads by view key
- `selectedIndexAtom`, `selectedPullRequestAtom` — selection state
- `diffFullViewAtom`, `commentsViewActiveAtom` — pane visibility
- `pullRequestCommentsAtom`, `diffCommentThreadsAtom` — comment state
- `activeModalAtom` — modal state (many modal types)
- `themeConfigAtom`, `themeIdAtom` — theming

### Runtime Layer (App.tsx L185-190)
```ts
githubRuntime = Atom.runtime(
  Layer.mergeAll(githubServiceLayer, cacheServiceLayer, Clipboard.layerNoDeps, BrowserOpener.layerNoDeps)
    .pipe(Layer.provide(CommandRunner.layer), Layer.provideMerge(Observability.layer))
)
```

## UI Components (src/ui/)

| File | Purpose |
|------|---------|
| `colors.ts` | Theme definitions, color palette, theme switching |
| `CommandPalette.tsx` | Command palette modal |
| `commentEditor.ts` | Multi-line text editor state/operations |
| `comments.tsx` | Comment rendering helpers |
| `CommentsPane.tsx` | Comments pane component |
| `DetailsPane.tsx` | PR detail view (header, body, scroll) |
| `diff.ts` | Diff parsing, stacked diff files, comment anchors, whitespace modes |
| `diffStats.tsx` | Diff statistics display |
| `FooterHints.tsx` | Footer keybinding hints + retry progress |
| `inlineSegments.ts` | Inline text segment parsing |
| `LoadingLogo.tsx` | Startup loading animation |
| `modals.tsx` | All modal types (Merge, Comment, Label, Theme, Close, etc.) |
| `primitives.tsx` | Base UI primitives (Divider, Filler, PlainLine, SeparatorColumn) |
| `PullRequestDiffPane.tsx` | Diff view pane |
| `PullRequestList.tsx` | PR list component with grouping |
| `pullRequests.ts` | PR metadata text helpers, groupBy |
| `singleLineInput.ts` | Single-line text input handling |
| `spinner.ts` | Spinner animation frames |

### Modal Types (from modals.tsx, imported in App.tsx L119-159)
`None`, `Label`, `Close`, `PullRequestState`, `Merge`, `Comment`, `DeleteComment`, `CommentThread`, `ChangedFiles`, `SubmitReview`, `Theme`, `CommandPalette`, `OpenRepository`

## Existing Plans (plans/)

| Plan | Status |
|------|--------|
| `sqlite-cache.md` | v1 **shipped**; v1.1/v1.2 (comments, diffs) tracked in cache-v2.md |
| `queued-reviews.md` | **Not started** — batch review comments under pending review |
| `cache-v2.md` | Comments, diffs, repo metadata persistence |
| `comments-pane-redesign.md` | Unknown status |
| `edit-delete-comments.md` | Likely shipped (edit/delete methods exist in GitHubService) |
| `system-theme-pairs.md` | Unknown status |

## ACP-Related Code

**Nothing ACP-specific exists in the codebase.** The only match for "acp" is the `.git` worktree file pointing to the parent repo `ghui-w-acp`. The worktree name suggests this is a fork/branch intended for ACP work, but no ACP-specific code, types, or configuration has been added yet.

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/domain.ts` | All domain types | L134-156 (PullRequestItem), L108-118 (ReviewComment), L120-132 (Comment union) |
| 2 | `src/config.ts` | App config | L17-27 (config object, env vars) |
| 3 | `src/services/GitHubService.ts` | GitHub API layer | L581-608 (service interface), L1-968 (full impl) |
| 4 | `src/services/CacheService.ts` | SQLite cache | L192-217 (schema), L365-373 (interface), L270-363 (live impl) |
| 5 | `src/services/CommandRunner.ts` | CLI execution | L32-98 (Bun.spawn wrapper) |
| 6 | `src/App.tsx` | Main app component + all state | L185-190 (runtime), L284-343 (data fetch), L704+ (render) |
| 7 | `src/pullRequestViews.ts` | View types | L3-6 (PullRequestView union) |
| 8 | `src/pullRequestLoad.ts` | Load state | L4-10 (PullRequestLoad) |
| 9 | `src/pullRequestCache.ts` | Detail merge | L3-19 (mergeCachedDetails) |
| 10 | `plans/queued-reviews.md` | Pending review plan | Full file (66 lines) |
| 11 | `plans/sqlite-cache.md` | Cache plan | Full file (271 lines) |
| 12 | `src/ui/modals.tsx` | All modal definitions | Referenced from App.tsx |
| 13 | `src/mergeActions.ts` | Merge CLI arg building | Referenced from GitHubService |
| 14 | `src/ui/diff.ts` | Diff parsing/rendering logic | Referenced from App.tsx |
| 15 | `package.json` | Dependencies and scripts | L61-78 |

## Architectural Context
- **Module structure**: Flat `src/` with `services/`, `ui/`, `keyboard/`, `keymap/` subdirs
- **State management**: Effect Atoms (`effect/unstable/reactivity/Atom`) with `Atom.runtime` for service integration
- **Rendering**: `@opentui/react` (terminal UI framework)
- **GitHub access**: All through `gh` CLI subprocess, never direct HTTP
- **Persistence**: SQLite via `@effect/sql-sqlite-bun`, optional (can be disabled)
- **Keybinding**: Custom keymap system (`@ghui/keymap` workspace package)
- **Monolith risk**: `App.tsx` is a single massive component (~2500+ lines) containing all state, effects, and event handlers

## Summary

ghui is a terminal-based GitHub PR review tool built on Bun + Effect + OpenTUI React. It uses `gh` CLI for all GitHub API interaction (both GraphQL and REST), persists queue/PR data in an optional SQLite cache, and renders in a split-pane TUI with PR list, detail view, diff view, and comments. The codebase has no ACP-related code — the `ghui-w-acp` name exists only in the git worktree reference. Key extension points for new features would be: adding methods to `GitHubService`, adding new modal types in `modals.tsx`, and wiring new atoms/effects in `App.tsx`. The `plans/` directory contains detailed architectural plans for features like queued reviews (not started) and cache v2 (comments/diffs persistence).
