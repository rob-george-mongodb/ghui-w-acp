# Codebase Research: ghui Deep Dive

## Research Question
Full understanding of ghui's domain types, services, config, plans, packages, and state management.

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `src/domain.ts` | 1 | 183 lines, all types documented below |
| 2 | Read `src/services/` directory | 6 files | GitHubService, CacheService, BrowserOpener, Clipboard, CommandRunner, MockGitHubService |
| 3 | Read `src/config.ts` | 1 | 27 lines |
| 4 | Read `plans/sqlite-cache.md` | 1 | 271 lines, v1 shipped |
| 5 | Read `plans/queued-reviews.md` | 1 | 66 lines, not started |
| 6 | Read `plans/comments-pane-redesign.md` | 1 | 328 lines, active exploration |
| 7 | Read `packages/` | 1 subdir | `keymap/` package only |
| 8 | Read `src/App.tsx` | 1 | 1019+ lines read (first half) |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/domain.ts` | All domain types | L1-183 |
| 2 | `src/services/GitHubService.ts` | GitHub API layer, all methods | L581-608 (interface), L610-968 (impl) |
| 3 | `src/services/CacheService.ts` | SQLite cache layer | L365-413 (interface + layers) |
| 4 | `src/services/CommandRunner.ts` | Process execution service | L32-99 |
| 5 | `src/services/BrowserOpener.ts` | Open URLs in browser | L13-39 |
| 6 | `src/services/Clipboard.ts` | System clipboard | L18-47 |
| 7 | `src/services/MockGitHubService.ts` | Test/dev mock | L121-283 |
| 8 | `src/config.ts` | App config from env vars | L1-27 |
| 9 | `src/App.tsx` | Main app component, all state atoms | L1-1019+ |

---

## All Types from `domain.ts`

### Literal/Union Types
- **`LoadStatus`**: `"loading" | "ready" | "error"`
- **`PullRequestState`**: `"open" | "closed" | "merged"`
- **`PullRequestUserQueueMode`**: `"authored" | "review" | "assigned" | "mentioned"`
- **`PullRequestQueueMode`**: `"repository" | PullRequestUserQueueMode`
- **`CheckConclusion`**: `"success" | "failure" | "neutral" | "skipped" | "cancelled" | "timed_out"`
- **`CheckRunStatus`**: `"completed" | "in_progress" | "queued" | "pending"`
- **`CheckRollupStatus`**: `"passing" | "pending" | "failing" | "none"`
- **`ReviewStatus`**: `"draft" | "approved" | "changes" | "review" | "none"`
- **`Mergeable`**: `"mergeable" | "conflicting" | "unknown"`
- **`DiffCommentSide`**: `"LEFT" | "RIGHT"` (Effect Schema literal, used at runtime)
- **`PullRequestMergeMethod`**: `"squash" | "merge" | "rebase"`
- **`PullRequestMergeKind`**: `"now" | "auto" | "admin" | "disable-auto"`
- **`PullRequestMergeMethodKind`**: `Exclude<PullRequestMergeKind, "disable-auto">`
- **`PullRequestReviewEvent`**: `"COMMENT" | "APPROVE" | "REQUEST_CHANGES"`

### Interfaces

**`CheckItem`**
```ts
{ name: string; status: CheckRunStatus; conclusion: CheckConclusion | null }
```

**`PullRequestLabel`**
```ts
{ name: string; color: string | null }
```

**`CreatePullRequestCommentInput`**
```ts
{ repository: string; number: number; commitId: string; path: string; line: number; side: DiffCommentSide; startLine?: number; startSide?: DiffCommentSide; body: string }
```

**`SubmitPullRequestReviewInput`**
```ts
{ repository: string; number: number; event: PullRequestReviewEvent; body: string }
```

**`PullRequestReviewComment`**
```ts
{ id: string; path: string; line: number; side: DiffCommentSide; author: string; body: string; createdAt: Date | null; url: string | null; inReplyTo: string | null }
```

**`PullRequestComment`** (tagged union)
```ts
| { _tag: "comment"; id: string; author: string; body: string; createdAt: Date | null; url: string | null }
| { _tag: "review-comment" } & PullRequestReviewComment
```

**`PullRequestItem`** (the core PR model)
```ts
{
  repository: string; author: string; headRefOid: string; headRefName: string;
  number: number; title: string; body: string; labels: readonly PullRequestLabel[];
  additions: number; deletions: number; changedFiles: number;
  state: PullRequestState; reviewStatus: ReviewStatus;
  checkStatus: CheckRollupStatus; checkSummary: string | null; checks: readonly CheckItem[];
  autoMergeEnabled: boolean; detailLoaded: boolean;
  createdAt: Date; closedAt: Date | null; url: string;
}
```

**`PullRequestPage`**
```ts
{ items: readonly PullRequestItem[]; endCursor: string | null; hasNextPage: boolean }
```

**`ListPullRequestPageInput`**
```ts
{ mode: PullRequestQueueMode; repository: string | null; cursor: string | null; pageSize: number }
```

**`PullRequestMergeInfo`**
```ts
{
  repository: string; number: number; title: string; state: PullRequestState;
  isDraft: boolean; mergeable: Mergeable; reviewStatus: ReviewStatus;
  checkStatus: CheckRollupStatus; checkSummary: string | null;
  autoMergeEnabled: boolean; viewerCanMergeAsAdmin: boolean;
}
```

**`PullRequestMergeAction`** (tagged union)
```ts
| { kind: PullRequestMergeMethodKind; method: PullRequestMergeMethod }
| { kind: "disable-auto" }
```

**`RepositoryMergeMethods`**
```ts
{ squash: boolean; merge: boolean; rebase: boolean }
```

### Utility Functions
- `pullRequestQueueSearchQualifier(mode, repository)` — builds GitHub search qualifier string
- `allowedMergeMethodList(allowed)` — filters merge methods by what repo allows
- `pullRequestQueueLabels` — display labels per queue mode
- `isReviewComment(comment)` / `isIssueComment(comment)` — type guards

---

## All GitHubService Methods (Signatures)

```ts
class GitHubService {
  listOpenPullRequests(mode: PullRequestQueueMode, repository: string | null): Effect<readonly PullRequestItem[], GitHubError>
  listOpenPullRequestPage(input: ListPullRequestPageInput): Effect<PullRequestPage, GitHubError>
  listOpenPullRequestDetails(mode: PullRequestQueueMode, repository: string | null): Effect<readonly PullRequestItem[], GitHubError>
  getPullRequestDetails(repository: string, number: number): Effect<PullRequestItem, GitHubError>
  getAuthenticatedUser(): Effect<string, GitHubError>
  getPullRequestDiff(repository: string, number: number): Effect<string, GitHubError>
  listPullRequestReviewComments(repository: string, number: number): Effect<readonly PullRequestReviewComment[], GitHubError>
  listPullRequestComments(repository: string, number: number): Effect<readonly PullRequestComment[], GitHubError>
  getPullRequestMergeInfo(repository: string, number: number): Effect<PullRequestMergeInfo, GitHubError>
  getRepositoryMergeMethods(repository: string): Effect<RepositoryMergeMethods, GitHubError>
  mergePullRequest(repository: string, number: number, action: PullRequestMergeAction): Effect<void, CommandError>
  closePullRequest(repository: string, number: number): Effect<void, CommandError>
  createPullRequestComment(input: CreatePullRequestCommentInput): Effect<PullRequestReviewComment, GitHubError>
  createPullRequestIssueComment(repository: string, number: number, body: string): Effect<PullRequestComment, GitHubError>
  replyToReviewComment(repository: string, number: number, inReplyTo: string, body: string): Effect<PullRequestComment, GitHubError>
  editPullRequestIssueComment(repository: string, commentId: string, body: string): Effect<PullRequestComment, GitHubError>
  editReviewComment(repository: string, commentId: string, body: string): Effect<PullRequestComment, GitHubError>
  deletePullRequestIssueComment(repository: string, commentId: string): Effect<void, CommandError>
  deleteReviewComment(repository: string, commentId: string): Effect<void, CommandError>
  submitPullRequestReview(input: SubmitPullRequestReviewInput): Effect<void, CommandError>
  toggleDraftStatus(repository: string, number: number, isDraft: boolean): Effect<void, CommandError>
  listRepoLabels(repository: string): Effect<readonly { name: string; color: string | null }[], GitHubError>
  addPullRequestLabel(repository: string, number: number, label: string): Effect<void, CommandError>
  removePullRequestLabel(repository: string, number: number, label: string): Effect<void, CommandError>
}
```

**`GitHubError`** = `CommandError | JsonParseError | Schema.SchemaError`

Implementation: All methods shell out to `gh` CLI via `CommandRunner`. GraphQL for list/detail queries, REST API for comments/diffs/merge/labels. Uses Effect Schema for response validation.

### Other Services

**`CacheService`**
```ts
{
  readQueue(viewer: string, view: PullRequestView): Effect<PullRequestLoad | null, CacheError>
  writeQueue(viewer: string, load: PullRequestLoad): Effect<void>
  readPullRequest(key: PullRequestCacheKey): Effect<PullRequestItem | null, CacheError>
  upsertPullRequest(pullRequest: PullRequestItem): Effect<void>
  prune(): Effect<void>
}
```
Layers: `disabledLayer` (no-op), `layerSqlite` (needs SqlClient), `layerSqliteFile(filename)` (full setup with migrations), `layerFromPath(filename | null)` (auto-selects disabled vs sqlite, catches failures).

**`CommandRunner`**
```ts
{
  run(command: string, args: readonly string[], options?: RunOptions): Effect<CommandResult, CommandError>
  runSchema<S>(schema: S, command: string, args: readonly string[]): Effect<S["Type"], CommandError | JsonParseError | SchemaError>
}
```

**`BrowserOpener`**
```ts
{
  openPullRequest(pullRequest: PullRequestItem): Effect<void, CommandError>
  openUrl(url: string): Effect<void, CommandError>
}
```

**`Clipboard`**
```ts
{
  copy(text: string): Effect<void, ClipboardError>
}
```

**`MockGitHubService`** — Generates synthetic PR data for dev/testing. Not a Context.Service, just provides `GitHubService` layer with mock data.

---

## DB Schema (SQLite Cache)

### Tables (from migration `001_initial_cache_schema`)

**`pull_requests`**
| Column | Type | Constraint |
|--------|------|-----------|
| pr_key | TEXT | PRIMARY KEY |
| repository | TEXT | NOT NULL |
| number | INTEGER | NOT NULL |
| url | TEXT | NOT NULL |
| head_ref_oid | TEXT | NOT NULL |
| state | TEXT | NOT NULL |
| detail_loaded | INTEGER | NOT NULL |
| data_json | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

Index: `pull_requests_repository_number_idx ON (repository, number)`

**`queue_snapshots`**
| Column | Type | Constraint |
|--------|------|-----------|
| viewer | TEXT | NOT NULL |
| view_key | TEXT | NOT NULL |
| view_json | TEXT | NOT NULL |
| pr_keys_json | TEXT | NOT NULL |
| fetched_at | TEXT | NOT NULL |
| end_cursor | TEXT | nullable |
| has_next_page | INTEGER | NOT NULL |

Primary key: `(viewer, view_key)`

**Migration table**: `ghui_cache_migrations` (managed by Effect SqliteMigrator)

### Pragmas
```sql
PRAGMA synchronous = NORMAL
PRAGMA busy_timeout = 5000
PRAGMA foreign_keys = ON
PRAGMA temp_store = MEMORY
PRAGMA journal_size_limit = 16777216
```
WAL enabled by default via `SqliteClient`.

### Pruning
- Queue snapshots older than 30 days deleted
- Orphaned pull_requests (not referenced by any queue snapshot AND updated_at > 30 days) deleted
- Triggered after successful queue writes

---

## Config Schema

From `src/config.ts` — resolved eagerly at module load via `Effect.runSync`:

```ts
{
  prFetchLimit: number    // env: GHUI_PR_FETCH_LIMIT, default 200, must be positive int
  prPageSize: number      // env: GHUI_PR_PAGE_SIZE, default 50, capped at 100
  cachePath: string|null  // env: GHUI_CACHE_PATH, default ~/.cache/ghui/cache.sqlite
                          // "off"/"0"/"false" → null (disables cache)
}
```

XDG_CACHE_HOME respected for default cache path.

---

## SQLite Cache Plan (`plans/sqlite-cache.md`)

**Status**: v1 foundation **shipped**. Comments, diffs, per-repo metadata deferred to `cache-v2.md`.

**What shipped**: Warm startup from disk, stale-while-revalidate queues, persistent hydrated PR details, best-effort writes, `GHUI_CACHE_PATH` escape hatch.

**Architecture**: `CacheService` alongside `GitHubService` in `githubRuntime`. Normalized queue membership (PR records stored once, snapshot stores ordered keys). Schema validated via Effect Schema on read; malformed rows treated as cache misses.

**Planned but not yet shipped** (v1.1/v1.2): Comments cache, diff cache, repo metadata cache, additional tables (`issue_comments_cache`, `review_comments_cache`, `diff_cache`, `repo_metadata_cache`).

---

## Queued Reviews Plan (`plans/queued-reviews.md`)

**Status**: Not started.

**Concept**: Support GitHub's pending review workflow. Stage multiple inline comments, submit together with verdict (Approve/Comment/Request Changes).

**New GitHubService methods needed**:
- `findPendingReview(repo, prNumber)`
- `createPendingReview(repo, prNumber)`
- `addPendingReviewComment(reviewId, input)`
- `submitPendingReview(reviewId, event, body?)`
- `discardPendingReview(reviewId)`

**UX**: `enter` = post immediately, `shift+enter` = add to pending. Pending count in diff header. `shift+R` submit-review modal extended with pending list. `shift+D` discard with confirm.

---

## Comments Pane Redesign Plan (`plans/comments-pane-redesign.md`)

**Status**: Active exploration, no canonical style chosen.

**Four styles explored**: Style A (stacked chat), Style B (newspaper), Style C (Charm prefix bar), Style D (tree with box-drawing). All share common rules: no dot separators, per-author hash-color, Slack-style author collapse for consecutive messages, file-grouped, one-column padding, single selection element.

---

## Packages Directory

Single package: `packages/keymap/`

Contents: `src/`, `test/`, `package.json`, `tsconfig.json`, `README.md`, `MIGRATION.md`, `COMPARISON.md`, `examples/`

This is a standalone keymap library (`@ghui/keymap`) used via `@ghui/keymap/react` in App.tsx.

---

## State Management in App.tsx

### Approach: Effect Atom (reactive atoms from `effect/unstable/reactivity/Atom`)

**Runtime**: `githubRuntime = Atom.runtime(Layer.mergeAll(githubServiceLayer, cacheServiceLayer, Clipboard, BrowserOpener).pipe(Layer.provide(CommandRunner), Layer.provideMerge(Observability)))` — a single Effect runtime that backs all async atoms.

### Core Atoms (module-level, outside component)

**Queue/PR Data Flow**:
- `activeViewAtom: Atom<PullRequestView>` — current queue view (authored/review/assigned/mentioned/repository)
- `queueLoadCacheAtom: Atom<Partial<Record<string, PullRequestLoad>>>` — in-memory cache of loaded queues by view key
- `pullRequestsAtom` — **async runtime atom** that: reads SQLite cache first, then fetches from GitHub, merges cached details, writes back to SQLite cache, stores in queueLoadCacheAtom
- `pullRequestLoadAtom` — derived: resolves current view's load from cache or async result
- `displayedPullRequestsAtom` — derived: applies overrides and recently-completed PRs
- `filteredPullRequestsAtom` — derived: applies filter query with scoring
- `visibleGroupsAtom` — derived: groups filtered PRs by repository
- `selectedPullRequestAtom` — derived: current selection from visible list

**Selection/Navigation**:
- `selectedIndexAtom`, `queueSelectionAtom`, `filterQueryAtom`, `filterDraftAtom`, `filterModeAtom`
- `detailFullViewAtom`, `detailScrollOffsetAtom`
- `diffFullViewAtom`, `diffFileIndexAtom`, `diffScrollTopAtom`, `diffRenderViewAtom`, `diffWrapModeAtom`, `diffWhitespaceModeAtom`
- `diffCommentAnchorIndexAtom`, `diffPreferredSideAtom`, `diffCommentRangeStartIndexAtom`
- `commentsViewActiveAtom`, `commentsViewSelectionAtom`

**PR Detail Data**:
- `pullRequestDiffCacheAtom: Atom<Record<string, PullRequestDiffState>>` — parsed diff state by diff key
- `diffCommentThreadsAtom` / `diffCommentsLoadedAtom` — review comments in diff view
- `pullRequestCommentsAtom` / `pullRequestCommentsLoadedAtom` — combined comments by PR key

**UI State**:
- `activeModalAtom: Atom<Modal>` — current modal (tagged union: Label, Close, Merge, Comment, etc.)
- `themeConfigAtom`, `systemAppearanceAtom`, `themeIdAtom` — theming
- `noticeAtom` — flash notice message
- `retryProgressAtom` — retry state for PR fetches
- `labelCacheAtom`, `repoMergeMethodsCacheAtom`, `lastUsedMergeMethodAtom` — per-repo caches
- `pullRequestOverridesAtom`, `recentlyCompletedPullRequestsAtom` — optimistic/transient PR state
- `usernameAtom` — async atom fetching authenticated GitHub user

**Async Action Atoms** (via `githubRuntime.fn<Input>()`):
- `listRepoLabelsAtom`, `listOpenPullRequestPageAtom`, `pullRequestDetailsAtom` (family by key)
- `readCachedPullRequestAtom`, `writeCachedPullRequestAtom`, `writeQueueCacheAtom`, `pruneCacheAtom`
- `addPullRequestLabelAtom`, `removePullRequestLabelAtom`, `toggleDraftAtom`
- `pullRequestDiffAtom` (family by key)
- `listPullRequestReviewCommentsAtom`, `listPullRequestCommentsAtom`
- `getPullRequestMergeInfoAtom`, `getRepositoryMergeMethodsAtom`, `mergePullRequestAtom`, `closePullRequestAtom`
- `createPullRequestCommentAtom`, `createPullRequestIssueCommentAtom`, `replyToReviewCommentAtom`
- `editPullRequestIssueCommentAtom`, `editReviewCommentAtom`, `deletePullRequestIssueCommentAtom`, `deleteReviewCommentAtom`
- `submitPullRequestReviewAtom`
- `copyToClipboardAtom`, `openInBrowserAtom`, `openUrlAtom`

### Data Flow Summary

```
GitHub API (via gh CLI)
    ↓
GitHubService (Effect service, Schema-validated)
    ↓
githubRuntime.atom / githubRuntime.fn (async atoms)
    ↓
pullRequestsAtom (fetches + caches to SQLite)
    ↓
queueLoadCacheAtom (in-memory by view key)
    ↓
pullRequestLoadAtom → displayedPullRequestsAtom → filteredPullRequestsAtom → visibleGroupsAtom
    ↓
selectedPullRequestAtom → detail/diff/comments atoms
    ↓
React component (App) via useAtomValue/useAtom hooks
```

Key pattern: `keepAlive` on atoms that should persist across component re-renders. `Atom.family` for per-PR detail/diff atoms keyed by `repository\0number\0headRefOid`.

---

## Summary

ghui is a terminal-based GitHub PR review tool built with React (OpenTUI renderer), Effect (for services/errors/schemas), and Effect Atoms (for reactive state). It shells out to `gh` CLI for all GitHub operations. State is managed via ~40+ module-level Effect atoms with derived atoms for filtering/grouping. A SQLite cache (v1 shipped) provides warm startup from disk with stale-while-revalidate semantics. The `packages/keymap` is a standalone keymap library. Two plans are in the pipeline: queued reviews (not started) and comments pane redesign (exploring).
