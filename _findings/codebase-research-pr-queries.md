# Codebase Research: Pull Request Queries

## Research Question
How are GitHub pull request queries implemented and used in this repository? Map all API calls, data flows, helpers, UI triggers, tests, and risks.

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `pullRequest\|pull_request\|PullRequest` in `src/**/*.ts` | 43 matches | UI display + keymap refs |
| 2 | `graphql\|GraphQL\|octokit\|Octokit` in `src/**/*.ts` | 0 | No direct GraphQL in src/; all in packages/core |
| 3 | `fetch.*pull\|query.*pull\|search.*pull\|list.*pull` in `src/**/*.ts` | 8 matches | Keymap command refs |
| 4 | `**/*.test.ts` glob | 32 files | Across core, keymap, and src/test |

## High-Level Summary

- **API approach**: All GitHub communication goes through the `gh` CLI (never direct HTTP/octokit). GraphQL queries are sent via `gh api graphql`, REST calls via `gh api repos/...`. The `gh` CLI handles auth.
- **Architecture**: `GitHubService` (Effect service in `packages/core`) is the single gateway. It uses `CommandRunner` to spawn `gh` processes, parses stdout with `Schema.decodeUnknownEffect`, and returns typed `PullRequestItem`s.
- **Query types**: 4 GraphQL queries (search with detail fields, search with summary fields, repository PR listing, single PR detail) + REST endpoints for diffs, comments, files, merge info, labels.
- **Pagination**: GraphQL uses cursor-based pagination via `endCursor`/`hasNextPage`. REST uses `gh api --paginate --slurp`. A `paginatePages` helper auto-paginates up to `appConfig.prFetchLimit` (default 200). The UI also supports manual "load more" via `listOpenPullRequestPage`.
- **Caching**: Two layers -- in-memory `queueLoadCacheAtom` (keyed by view) and SQLite `CacheService` for persistence across sessions. `mergeCachedDetails` preserves detail fields from cached PRs when the head SHA hasn't changed.
- **UI flow**: `App.tsx` creates Effect atoms (`githubRuntime.atom`/`githubRuntime.fn`) that call `GitHubService` methods. React hooks (`useAtomValue`/`useAtomSet`) trigger queries on mount, refresh, view switch, or user action.

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/services/GitHubService.ts` | **Central API layer** -- all GH queries defined here | L263-306 (GraphQL queries), L581-608 (service interface), L610-968 (implementation) |
| 2 | `packages/core/src/domain.ts` | Domain types: `PullRequestItem`, `PullRequestPage`, `ListPullRequestPageInput`, queue modes | L1-183 |
| 3 | `packages/core/src/pullRequestViews.ts` | View abstraction (Repository vs Queue), cache keys, search qualifier routing | L1-42 |
| 4 | `packages/core/src/pullRequestCache.ts` | `mergeCachedDetails` -- merges fresh list data with cached detail fields | L1-19 |
| 5 | `packages/core/src/pullRequestLoad.ts` | `PullRequestLoad` interface (view + data + pagination cursor) | L1-10 |
| 6 | `packages/core/src/config.ts` | `AppConfig` with `prFetchLimit` (200), `prPageSize` (50) env-configurable | L1-35 |
| 7 | `packages/core/src/services/CommandRunner.ts` | Process spawning + JSON parse + Schema decode | L1-99 |
| 8 | `packages/core/src/services/CacheService.ts` | SQLite persistence for PR data and queue snapshots | L1-413 |
| 9 | `packages/core/src/services/MockGitHubService.ts` | Mock implementation for dev/test | L1-283 |
| 10 | `src/App.tsx` | UI entry: atom definitions, query triggers, event handlers | L294-352 (pullRequestsAtom), L479-542 (fn atoms for every GH operation) |
| 11 | `packages/core/src/appCommands.ts` | Command definitions including `pull.refresh`, `pull.load-more` | L134-197 |

## Code Path Map

### Entry Point 1: Initial PR Load (app startup / view switch / refresh)

1. `pullRequestsAtom` (App.tsx:294) -- Effect atom that runs on mount and whenever `activeViewAtom` changes
2. Reads `activeViewAtom` to determine queue mode + repository
3. Calls `cacheService.readQueue()` to populate UI immediately from SQLite cache
4. Calls `github.listOpenPullRequestPage()` (GitHubService.ts:669)
5. `listOpenPullRequestPage` dispatches to either:
   - `listRepositoryPullRequestPage` (L642) for `mode === "repository"` -- uses `repositoryPullRequestsQuery` GraphQL
   - `listOpenPullRequestSearchPage` (L639) for user queues -- uses `pullRequestSummarySearchQuery` GraphQL via GitHub search API
6. Both use `gh api graphql -f query=... -F searchQuery=...` spawned via `CommandRunner`
7. Response parsed through Schema, normalized via `parsePullRequestSummary`/`parsePullRequest`
8. Result stored in `queueLoadCacheAtom` and written to SQLite via `cacheService.writeQueue()`
9. Retries: exponential backoff, up to 6 retries (App.tsx:329)

### Entry Point 2: Load More (pagination)

1. User triggers `pull.load-more` command (appCommands.ts:190)
2. App.tsx calls `loadPullRequestPage()` with current view's `endCursor`
3. Calls `github.listOpenPullRequestPage()` with cursor
4. New items appended via `appendPullRequestPage` (App.tsx:276), deduped by URL

### Entry Point 3: PR Detail Hydration (prefetch)

1. `pullRequestDetailsAtom` family (App.tsx:481) keyed by `repository\0number\0headRefOid`
2. Calls `github.getPullRequestDetails()` (GitHubService.ts:701)
3. Uses `pullRequestDetailQuery` GraphQL -- fetches body, labels, additions/deletions/changedFiles
4. Prefetched for PRs near the selected index (DETAIL_PREFETCH_BEHIND=1, DETAIL_PREFETCH_AHEAD=3)

### Entry Point 4: Diff Loading

1. `pullRequestDiffAtom` family (App.tsx:500)
2. Calls `github.getPullRequestDiff()` (GitHubService.ts:728)
3. Uses REST: `gh api --paginate --slurp repos/{owner}/{repo}/pulls/{number}/files`
4. Assembled into unified diff patch via `pullRequestFilesToPatch`

### Entry Point 5: Comments Loading

1. `listPullRequestCommentsAtom` (App.tsx:507) / `listPullRequestReviewCommentsAtom` (App.tsx:504)
2. `listPullRequestComments` (GitHubService.ts:738) fetches both issue comments and review comments concurrently
3. REST: `gh api --paginate --slurp repos/{repo}/issues/{number}/comments` + `repos/{repo}/pulls/{number}/comments`
4. Merged and sorted by timestamp

### Search Query Construction

1. `pullRequestQueueSearchQualifier()` (domain.ts:20-30) builds GitHub search qualifiers:
   - `authored` -> `author:@me archived:false`
   - `review` -> `review-requested:@me archived:false`
   - `assigned` -> `assignee:@me archived:false`
   - `mentioned` -> `mentions:@me archived:false`
   - `repository` -> `repo:{owner/name}` (no `archived:false`)
2. `searchQuery()` (GitHubService.ts:454) appends `is:pr is:open sort:...`

## Helpers

| File | Identifier | Description |
|------|-----------|-------------|
| `packages/core/src/pullRequestCache.ts` | `mergeCachedDetails()` | Preserves body/labels/stats from cached PRs when headRefOid matches |
| `packages/core/src/domain.ts:20` | `pullRequestQueueSearchQualifier()` | Builds GitHub search qualifiers per queue mode |
| `packages/core/src/pullRequestViews.ts` | `viewCacheKey()`, `viewMode()`, `viewRepository()` | View -> cache key / mode / repo mapping |
| `packages/core/src/config.ts` | `AppConfig` / `resolveAppConfig` | Env-configurable prFetchLimit, prPageSize |
| `GitHubService.ts:459` | `pullRequestPage()` | Normalizes GraphQL connection to `PullRequestPage` |
| `GitHubService.ts:408` | `parsePullRequestSummary()` | Raw GraphQL node -> `PullRequestItem` |
| `GitHubService.ts:435` | `parsePullRequest()` | Raw detail node -> `PullRequestItem` with full fields |
| `GitHubService.ts:366` | `getCheckInfoFromContexts()` | Aggregates check statuses into rollup |
| `App.tsx:276` | `appendPullRequestPage()` | Deduped append for "load more" |
| `GitHubService.ts:528` | `flattenSlurpedPages()` | Handles gh `--slurp` returning array-of-arrays |

## UI -> Query Map

| UI Action | Command ID | Query Triggered | File:Line |
|-----------|-----------|----------------|-----------|
| App mount / view switch | (automatic) | `listOpenPullRequestPage` | App.tsx:294-352 |
| Press `r` | `pull.refresh` | Re-evaluates `pullRequestsAtom` | App.tsx:719, appCommands.ts:135 |
| Scroll to bottom / press load-more | `pull.load-more` | `listOpenPullRequestPage` (with cursor) | appCommands.ts:190, App.tsx:821 |
| Select PR / open details | `detail.open` | `getPullRequestDetails` (prefetch) | App.tsx:481-484 |
| Open diff (`d`) | `diff.open` | `getPullRequestDiff` | App.tsx:500-503 |
| Open comments (`c`) | `comments.open` | `listPullRequestComments` | App.tsx:507-509 |
| Open merge modal (`m`) | `pull.merge` | `getPullRequestMergeInfo` + `getRepositoryMergeMethods` | App.tsx:510-513 |
| Submit review (`shift-r`) | `pull.submit-review` | `submitPullRequestReview` | App.tsx:539 |
| Toggle draft (`s`) | `pull.toggle-draft` | `toggleDraftStatus` | App.tsx:497-499 |
| Manage labels (`l`) | `pull.labels` | `listRepoLabels` | App.tsx:479, 820 |
| Auto-refresh (timer) | (automatic) | Re-evaluates `pullRequestsAtom` | App.tsx:263 (`FOCUSED_IDLE_REFRESH_MS`) |
| Terminal re-focus | (automatic) | Conditional refresh if stale | App.tsx:262 (`FOCUS_RETURN_REFRESH_MIN_MS`) |

## Tests

| Test File | Covers | Notes |
|-----------|--------|-------|
| `packages/core/test/pullRequestCache.test.ts` | `mergeCachedDetails` -- SHA change invalidation, field preservation | Good unit coverage |
| `packages/core/test/githubServiceComments.test.ts` | Comment parsing, REST id extraction, reply-to-review flow | Uses fake CommandRunner; covers comment CRUD |
| `packages/core/test/githubDiff.test.ts` | Diff file parsing / patch construction | - |
| `packages/core/test/cacheService.test.ts` | SQLite cache read/write/prune | - |
| `packages/core/test/domain.test.ts` | Queue search qualifiers, domain types | - |
| `test/pullRequestList.test.ts` | `buildPullRequestListRows` UI row generation | - |
| `test/pullRequestsDisplay.test.ts` | Display formatting for PR rows | - |
| `packages/core/src/services/MockGitHubService.ts` | Full mock implementation used for dev/visual testing | Supports pagination mock |

**Test gaps**: No dedicated tests for `listOpenPullRequestPage`, `paginatePages`, `listRepositoryPullRequestPage`, retry logic, or GraphQL query construction/response parsing in `GitHubService`. Error handling for malformed GraphQL responses is only implicitly covered by Schema validation.

## Risks & TODOs

1. **No rate-limit handling**: `CommandRunner` treats any non-zero exit as `CommandError`. GitHub rate limits (via `gh` CLI) would surface as opaque errors with no backoff beyond the initial retry.
2. **Status checks capped at 100**: `STATUS_CHECK_FRAGMENT` uses `contexts(first: 100)` (GitHubService.ts:217). PRs with >100 checks will have incomplete check data with no warning.
3. **Search API type: ISSUE**: The search queries use `type: ISSUE` (GitHubService.ts:265,286) which works for PRs but is semantically odd -- this is correct per GitHub's API but could confuse maintainers.
4. **Large App.tsx**: All atom definitions, query wiring, and UI logic live in a single ~2000+ line file. Query orchestration is tightly coupled to the React component.
5. **No test for GraphQL response parsing**: The `parsePullRequestSummary`/`parsePullRequest` functions and Schema decoders have no unit tests. A GitHub API schema change would only be caught at runtime.
6. **Duplicate detail hydration path**: Details can come from both `pullRequestDetailsAtom` (single PR GraphQL) and `listOpenPullRequestDetailsPage` (search with detail fields). The latter is wired but only used by `listOpenPullRequestDetails` which doesn't appear to be called from the UI currently.
7. **No cancellation on view switch**: When switching views, the in-flight `pullRequestsAtom` evaluation isn't explicitly cancelled; it relies on Effect atom semantics.

## Recommendations

1. **Extract query orchestration from App.tsx** -- Move the `pullRequestsAtom`, prefetch logic, and "load more" handler into a dedicated module (e.g. `packages/core/src/pullRequestQueue.ts`) for testability and readability.
2. **Add unit tests for GraphQL response parsing** -- Test `parsePullRequestSummary`, `parsePullRequest`, and the Schema decoders against realistic GitHub API payloads, including edge cases (null fields, missing statusCheckRollup).
3. **Add integration tests for `paginatePages` and `listOpenPullRequestPage`** -- Use the fake `CommandRunner` pattern from `githubServiceComments.test.ts` to verify cursor threading, page size clamping, and fetch limit enforcement.
4. **Handle rate limiting** -- Parse `gh` CLI stderr for rate-limit messages and implement specific backoff, or surface a user-visible notice.
5. **Paginate status checks** -- If >100 checks is a realistic scenario, add cursor-based pagination to the `STATUS_CHECK_FRAGMENT`, or at minimum log a warning.
6. **Remove or exercise `listOpenPullRequestDetails`** -- It's dead code in the current UI flow; either wire it up or remove to reduce confusion.
