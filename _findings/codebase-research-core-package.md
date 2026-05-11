# Codebase Research: Core Package Architecture

## Research Question
What is the full architecture of `packages/core/` — its public API, data types, GitHub data fetching/caching, available operations, and dependency chain?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Read `packages/core/src/index.ts` | 1 | Barrel file, 88 lines |
| 2 | Read `packages/core/src/domain.ts` | 1 | 183 lines, all domain types |
| 3 | Read `packages/core/src/services/` directory | 6 files | BrowserOpener, CacheService, Clipboard, CommandRunner, GitHubService, MockGitHubService |
| 4 | Read all service files | 6 | Full implementations read |
| 5 | Read `diff.ts`, `search.ts`, `commands.ts`, `appCommands.ts`, `mergeActions.ts`, `pullRequestViews.ts`, `pullRequestCache.ts`, `pullRequestLoad.ts`, `prQueries.ts`, `runtime.ts` | 10 | All read in full |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/domain.ts` | All PR domain types and enums | L1-183 |
| 2 | `packages/core/src/services/GitHubService.ts` | GitHub API layer — GraphQL + REST via `gh` CLI | L588-617 (service interface), L618-977 (implementation) |
| 3 | `packages/core/src/services/CommandRunner.ts` | Shell command execution layer (`Bun.spawn`) | L48-57 (interface), L59-117 (impl) |
| 4 | `packages/core/src/services/CacheService.ts` | SQLite-backed PR cache | L365-373 (interface), L270-363 (impl) |
| 5 | `packages/core/src/diff.ts` | Diff parsing, whitespace handling, anchor navigation | L1-418 |
| 6 | `packages/core/src/search.ts` | Fuzzy file-path search + label filtering | L1-173 |
| 7 | `packages/core/src/commands.ts` | Command palette model (AppCommand, filtering, scoring) | L1-91 |
| 8 | `packages/core/src/appCommands.ts` | Concrete command definitions for the UI | L75-458 |
| 9 | `packages/core/src/mergeActions.ts` | Merge kind definitions, CLI arg generation | L1-151 |
| 10 | `packages/core/src/pullRequestViews.ts` | View discriminated union (Repository vs Queue) | L1-42 |
| 11 | `packages/core/src/pullRequestCache.ts` | In-memory detail merging (not persistence) | L1-19 |
| 12 | `packages/core/src/pullRequestLoad.ts` | `PullRequestLoad` interface | L1-10 |
| 13 | `packages/core/src/runtime.ts` | `makeCoreLayer` — wires all Effect layers together | L1-29 |
| 14 | `packages/core/src/services/BrowserOpener.ts` | Opens PRs in browser via `gh pr view --web` or platform opener | L1-39 |
| 15 | `packages/core/src/services/Clipboard.ts` | Clipboard copy via platform tools | L1-47 |

## Architecture Overview

### Framework
The entire core package is built on **Effect-TS**. Services are defined as `Context.Service` classes with `Layer`-based dependency injection. The runtime is assembled in `runtime.ts` via `makeCoreLayer()`.

### Data Types (`domain.ts`)

**Enums/Literals:**
- `PullRequestState`: `"open" | "closed" | "merged"`
- `PullRequestQueueMode`: `"repository" | "authored" | "review" | "assigned" | "mentioned"`
- `CheckRunStatus`: `"completed" | "in_progress" | "queued" | "pending"`
- `CheckConclusion`: `"success" | "failure" | "neutral" | "skipped" | "cancelled" | "timed_out"`
- `CheckRollupStatus`: `"passing" | "pending" | "failing" | "none"`
- `ReviewStatus`: `"draft" | "approved" | "changes" | "review" | "none"`
- `PullRequestMergeMethod`: `"squash" | "merge" | "rebase"`
- `PullRequestMergeKind`: `"now" | "auto" | "admin" | "disable-auto"`
- `PullRequestReviewEvent`: `"COMMENT" | "APPROVE" | "REQUEST_CHANGES"`
- `DiffCommentSide`: `"LEFT" | "RIGHT"` (Effect Schema literal)

**Core Interfaces:**
- **`PullRequestItem`** — the main PR model: repository, author, headRefOid/Name, number, title, body, labels, additions/deletions/changedFiles, state, reviewStatus, checkStatus, checkSummary, checks[], autoMergeEnabled, detailLoaded, createdAt, closedAt, url
- **`PullRequestPage`** — paginated list: items[], endCursor, hasNextPage
- **`PullRequestMergeInfo`** — enriched merge state: mergeable, isDraft, viewerCanMergeAsAdmin
- **`PullRequestReviewComment`** — inline review comment: path, line, side, author, body, inReplyTo
- **`PullRequestComment`** — tagged union (`"comment"` | `"review-comment"`)
- **`CheckItem`** — name, status, conclusion
- **`RepositoryMergeMethods`** — which merge methods the repo allows
- **`CreatePullRequestCommentInput`**, **`SubmitPullRequestReviewInput`** — mutation inputs

### Diff Module (`diff.ts`)

**Types:**
- `DiffView`: `"unified" | "split"`
- `DiffWrapMode`: `"none" | "word"`
- `DiffWhitespaceMode`: `"ignore" | "show"`
- `DiffFilePatch`: `{ name, filetype, patch }`
- `DiffCommentAnchor`: `{ path, line, side, kind, renderLine, colorLine, text }`
- `PullRequestDiffState`: Tagged enum `Loading | Ready | Error`

**Key functions:**
- `splitPatchFiles(patch, options?) → DiffFilePatch[]` — splits a unified diff into per-file patches
- `minimizeWhitespacePatch(patch) → string` — removes whitespace-only changes via LCS
- `normalizeHunkLineCounts(patch) → string` — recalculates hunk header counts
- `verticalDiffAnchor(anchors, current, delta)` — navigate anchors vertically
- `scrollTopForVisibleLine(...)` — viewport scrolling math

### GitHub Data Fetching (`services/GitHubService.ts`)

All GitHub interaction goes through the **`gh` CLI** (not direct HTTP). The service uses:
- **GraphQL** (`gh api graphql`) for PR listing (search + repository queries) and admin merge info
- **REST** (`gh api repos/...`) for diff files, comments, comment mutations
- **CLI subcommands** (`gh pr merge`, `gh pr close`, `gh pr review`, `gh pr ready`, `gh label list`, `gh pr edit`) for mutations

**GitHubService interface (24 methods):**
```typescript
listOpenPullRequests(mode, repository) → Effect<PullRequestItem[], GitHubError>
listOpenPullRequestPage(input: ListPullRequestPageInput) → Effect<PullRequestPage, GitHubError>
getPullRequestDetails(repository, number) → Effect<PullRequestItem, GitHubError>
getAuthenticatedUser() → Effect<string, GitHubError>
getPullRequestDiff(repository, number) → Effect<string, GitHubError>
listPullRequestReviewComments(repository, number) → Effect<PullRequestReviewComment[], GitHubError>
listPullRequestComments(repository, number) → Effect<PullRequestComment[], GitHubError>
getPullRequestMergeInfo(repository, number) → Effect<PullRequestMergeInfo, GitHubError>
getRepositoryMergeMethods(repository) → Effect<RepositoryMergeMethods, GitHubError>
mergePullRequest(repository, number, action) → Effect<void, GitHubError>
closePullRequest(repository, number) → Effect<void, GitHubError>
createPullRequestComment(input) → Effect<PullRequestReviewComment, GitHubError>
createPullRequestIssueComment(repository, number, body) → Effect<PullRequestComment, GitHubError>
replyToReviewComment(repository, number, inReplyTo, body) → Effect<PullRequestComment, GitHubError>
editPullRequestIssueComment(repository, commentId, body) → Effect<PullRequestComment, GitHubError>
editReviewComment(repository, commentId, body) → Effect<PullRequestComment, GitHubError>
deletePullRequestIssueComment(repository, commentId) → Effect<void, GitHubError>
deleteReviewComment(repository, commentId) → Effect<void, GitHubError>
submitPullRequestReview(input) → Effect<void, GitHubError>
toggleDraftStatus(repository, number, isDraft) → Effect<void, GitHubError>
listRepoLabels(repository) → Effect<{name, color}[], GitHubError>
addPullRequestLabel(repository, number, label) → Effect<void, GitHubError>
removePullRequestLabel(repository, number, label) → Effect<void, GitHubError>
```

**Data parsing:** Raw GraphQL/REST responses are decoded via Effect `Schema` into domain types. Two parsers exist:
- `parsePullRequestSummary` — lightweight (no body/labels/stats), sets `detailLoaded: false`
- `parsePullRequest` — full detail, sets `detailLoaded: true`

**Pagination:** `listOpenPullRequestPage` routes to either `searchPage` (GraphQL search) or `listRepositoryPullRequestPage` (GraphQL `repository.pullRequests`) depending on mode. `paginatePages` auto-paginates up to `appConfig.prFetchLimit`.

### Caching Layer

**In-memory merge (`pullRequestCache.ts`):**
- `mergeCachedDetails(fresh, cached)` — preserves body/labels/stats from cached items when headRefOid matches and `detailLoaded` is true. Avoids re-fetching detail data on refresh.

**SQLite persistence (`services/CacheService.ts`):**
- Two tables: `pull_requests` (keyed by `repo#number`) and `queue_snapshots` (keyed by `viewer + view_key`)
- `readQueue(viewer, view) → PullRequestLoad | null` — restores a cached queue snapshot
- `writeQueue(viewer, load)` — persists current queue with all PR data, merges with existing cached details
- `readPullRequest(key)` / `upsertPullRequest(pr)` — single-PR CRUD
- `prune()` — deletes data older than 30 days
- `layerFromPath(filename)` — creates SQLite-backed layer, falls back to disabled (no-op) layer on error

**`PullRequestLoad` (`pullRequestLoad.ts`):**
```typescript
interface PullRequestLoad {
  view: PullRequestView
  data: readonly PullRequestItem[]
  fetchedAt: Date | null
  endCursor: string | null
  hasNextPage: boolean
}
```

### Views (`pullRequestViews.ts`)

```typescript
type PullRequestView =
  | { _tag: "Repository"; repository: string }
  | { _tag: "Queue"; mode: PullRequestUserQueueMode; repository: string | null }
```

Key functions: `viewMode`, `viewCacheKey`, `viewEquals`, `viewLabel`, `activePullRequestViews`, `nextView`, `parseRepositoryInput` (parses GitHub URLs / `owner/repo` shorthand).

### Search (`search.ts`)

- `filterLabels(labels, query)` — simple case-insensitive substring filter
- `fuzzyPathMatch(path, query) → { score, matchIndexes } | null` — multi-token fuzzy path matching with segment-aware scoring (basename bonus, word-boundary bonus, contiguity bonus)
- `filterChangedFiles(files, query) → ChangedFileSearchResult[]` — applies fuzzy matching to file lists, returns sorted results with highlight indexes

### Commands (`commands.ts` + `appCommands.ts`)

**`commands.ts`** defines the command palette infrastructure:
```typescript
interface AppCommand {
  id: string; title: string; scope: CommandScope; run: () => void
  subtitle?: string; shortcut?: string; keywords?: string[]; disabledReason?: string | null
}
type CommandScope = "Global" | "View" | "Pull request" | "Diff" | "Comments" | "Navigation" | "System"
```
- `filterCommands(commands, query)` — fuzzy search with acronym matching, scoring, enabled-first sorting
- `sortCommandsByScope` / `sortCommandsByActiveScope` — scope-based ordering

**`appCommands.ts`** defines `buildAppCommands(input) → AppCommand[]` — constructs ~35 concrete commands from current UI state. Takes an `AppCommandActions` interface of callbacks. Commands include: open palette, refresh, filter, theme, repository picker, view switching, PR details/diff/comments, diff navigation (files, threads, ranges), merge/close/review/labels, browser open, clipboard copy, quit.

### Merge Actions (`mergeActions.ts`)

Defines `MergeKindDefinition` for each merge kind (now, auto, disable-auto, admin) with:
- Availability predicates (e.g., `isCleanlyMergeable` checks open + not draft + mergeable + no failing checks)
- Display text (title, description, pastTense) parameterized by merge method
- Optimistic state updates (`optimisticState`, `optimisticAutoMergeEnabled`)

Key functions:
- `availableMergeKinds(info) → MergeKindDefinition[]`
- `visibleMergeKinds(info, allowed, selected)` — filters by repo-allowed methods
- `requiresMarkReady(info, kind)` — true if PR is draft and kind needs ready status
- `mergeActionCliArgs(action) → string[]` — generates `gh pr merge` CLI flags
- `mergeInfoFromPullRequest(pr) → PullRequestMergeInfo` — converts list item to merge info (with `mergeable: "unknown"`)

### Dependency Chain (`runtime.ts`)

```
makeCoreLayer(options)
├── AppConfigService (from options.appConfig)
├── CommandRunner.layer (Bun.spawn)
├── GitHubService.layerNoDeps ← CommandRunner + AppConfigService
│   (or MockGitHubService.layer if mock mode)
├── CacheService.layerFromPath ← SQLite file path from config
│   (or CacheService.disabledLayer if mock mode)
├── Clipboard.layerNoDeps ← CommandRunner
├── BrowserOpener.layerNoDeps ← CommandRunner
└── Observability.layer
```

All services depend on `CommandRunner` which wraps `Bun.spawn`. `GitHubService` additionally depends on `AppConfigService` for `prFetchLimit`. `CacheService` is self-contained with SQLite.

### Error Types
- `CommandError` — shell command failed (non-zero exit)
- `RateLimitError` — GitHub rate limit detected in stderr
- `JsonParseError` — stdout wasn't valid JSON
- `Schema.SchemaError` — response didn't match expected schema
- `CacheError` — SQLite/cache operation failed
- `ClipboardError` — clipboard copy failed
- `GitHubError` = `CommandError | RateLimitError | JsonParseError | Schema.SchemaError`

## Summary

`packages/core/` is a pure data/logic layer for a GitHub PR review TUI called **ghui**. It defines the complete PR domain model (`PullRequestItem`, views, merge actions, diff types, commands), provides GitHub API access exclusively through the `gh` CLI (via `CommandRunner` → `Bun.spawn`), persists PR data in a SQLite cache, and exports a command palette system with fuzzy search. The package uses Effect-TS throughout for dependency injection (layers/services), error handling (tagged errors), and schema validation. It has zero UI code — all rendering lives in a separate package that consumes these exports.
