# Codebase Research: PR Listing GraphQL Surface & Test Coverage

## Research Question
What GraphQL fields does the PR listing surface currently fetch, what fields would be needed to mimic GitHub's inbox grouping/status chips, and what existing tests would need to expand?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `pullRequest\|PullRequest` in `packages/core/src` | 51 matches | Core domain + service layer |
| 2 | `GraphQL\|graphql\|query\s+\{\|search\(` in `packages/core/src` | 8 matches | All in GitHubService.ts |
| 3 | `buildPullRequestListRows` in `*.tsx` | 4 matches | PullRequestList.tsx + App.tsx |
| 4 | `PullRequestItem` in `packages/core/src` | 51 matches | Domain type used everywhere |
| 5 | `pullRequest\|PullRequest` in `*.test.*` | 132 matches | 7 test files |
| 6 | `updatedAt\|updated_at\|latestReview\|timelineItems` | 0 files | Not fetched anywhere |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/domain.ts` | `PullRequestItem` interface — the canonical shape | L134-L156 |
| 2 | `packages/core/src/services/GitHubService.ts` | GraphQL queries, parsing, service API | L215-L306 (queries), L413-L457 (parsers), L588-L616 (service interface) |
| 3 | `src/ui/PullRequestList.tsx` | List row builder, grouping by repository | L8-L87 |
| 4 | `src/ui/pullRequests.ts` | Row display logic (review icon, check label, status color) | L15-L93 |
| 5 | `packages/core/test/githubServiceQueries.test.ts` | Tests for parsing + service page methods | Full file (443 lines) |
| 6 | `test/pullRequestList.test.ts` | Tests for `buildPullRequestListRows` | Full file |
| 7 | `test/pullRequestsDisplay.test.ts` | Tests for `pullRequestRowDisplay`, review/check icons | Full file |
| 8 | `packages/core/test/prQueries.test.ts` | Tests for `appendPullRequestPage` dedup | Full file |
| 9 | `packages/core/test/cacheService.test.ts` | Cache round-trip tests for PR items | Full file |
| 10 | `packages/core/src/services/CacheService.ts` | Cache schema — must evolve with domain | L40-L69 (schema), L102-L160 (encode/decode) |

## Code Path Map

### Entry Point: `GitHubService.listOpenPullRequestPage` (`GitHubService.ts:L677`)
1. Clamps pageSize to 1–100 at L678
2. If `mode === "repository"` → `listRepositoryPullRequestPage` at L680 → uses `repositoryPullRequestsQuery` (L296) with `SUMMARY_FIELDS_FRAGMENT`
3. Otherwise → `listOpenPullRequestSearchPage` at L681 → uses `pullRequestSummarySearchQuery` (L284) with `SUMMARY_FIELDS_FRAGMENT`
4. Both produce `PullRequestPage` via `pullRequestPage()` at L464, parsing each node through `parsePullRequestSummary` at L413

### GraphQL Fragment: `SUMMARY_FIELDS_FRAGMENT` (L226-L240)
Fields fetched: `number`, `title`, `isDraft`, `reviewDecision`, `autoMergeRequest { enabledAt }`, `state`, `merged`, `createdAt`, `closedAt`, `url`, `author { login }`, `headRefOid`, `headRefName`, `repository { nameWithOwner }`, `statusCheckRollup { contexts(first:100) { ... } }`

### GraphQL Fragment: `DETAIL_FIELDS_FRAGMENT` (L242-L261)
Adds to summary: `body`, `additions`, `deletions`, `changedFiles`, `labels(first:20) { nodes { name color } }`

### Parsing: `parsePullRequestSummary` (L413-L438)
Maps raw GraphQL to `PullRequestItem`. Note: summary sets `body=""`, `labels=[]`, `additions/deletions/changedFiles=0`, `detailLoaded=false`.

### UI Grouping: `visibleGroupsAtom` (`App.tsx:L449`)
Groups by `pullRequest.repository` using a `groupBy` utility. No inbox-style grouping (e.g., "needs your review", "approved", "changes requested").

### Row Display: `pullRequestRowDisplay` (`pullRequests.ts:L67`)
Renders review icon (draft/merged/closed/auto-merge/review status) and check icon (passing/pending/failing/none).

## Fields NOT Currently Fetched (Needed for GitHub Inbox-Style Chips)

| Field | GitHub GraphQL API | Purpose |
|-------|--------------------|---------|
| `updatedAt` | `PullRequest.updatedAt` | Sort by activity, "last updated" display |
| `isDraft` | Already fetched, but not on `PullRequestItem` | Only used to derive `reviewStatus:"draft"` — not preserved as a standalone boolean (except in `PullRequestMergeInfo`) |
| `totalCommentsCount` | `PullRequest.totalCommentsCount` | Comment count chip |
| `reviewRequests` | `PullRequest.reviewRequests(first:N) { nodes { requestedReviewer { ... on User { login } } } }` | "Review requested from you" grouping |
| `latestOpinionatedReviews` | `PullRequest.latestOpinionatedReviews(first:N) { nodes { author { login } state } }` | Per-reviewer approval/changes chips |
| `mergeable` | `PullRequest.mergeable` (enum: MERGEABLE, CONFLICTING, UNKNOWN) | Conflict indicator chip |
| `timelineItems` (filtered) | `PullRequest.timelineItems(last:1) { updatedAt }` | "Last activity" timestamp |
| `participants` | `PullRequest.participants(first:N) { totalCount }` | Participant count |
| `assignees` | `PullRequest.assignees(first:N) { nodes { login } }` | Assignee display |

Note: `isDraft` is fetched in GraphQL and used to set `reviewStatus:"draft"`, but the raw boolean is discarded by `parsePullRequestSummary`. The `PullRequestMergeInfo` interface (L171) does carry `isDraft` separately.

## Architectural Context

- **Module**: `@ghui/core` (packages/core) — domain types, services, queries. `src/` — UI components (React/OpenTUI).
- **Dependencies**: Effect library for service/layer pattern; `gh` CLI as the actual GitHub API transport (no direct HTTP — all queries go through `gh api graphql`).
- **Configuration**: `AppConfigService` provides `prFetchLimit` and `prPageSize`. `CacheService` caches PR items in SQLite with a schema (`CachedPullRequestItemSchema` at CacheService.ts:L40) that must be kept in sync with domain changes.
- **Related Tests**:
  - `packages/core/test/githubServiceQueries.test.ts` — parser unit tests + service integration with fake CommandRunner
  - `packages/core/test/prQueries.test.ts` — `appendPullRequestPage` dedup
  - `packages/core/test/cacheService.test.ts` — cache read/write round-trips
  - `test/pullRequestList.test.ts` — `buildPullRequestListRows` row construction
  - `test/pullRequestsDisplay.test.ts` — row display formatting
  - `test/detailsPane.test.ts` — detail pane layout
  - `packages/core/test/appCommands.test.ts` — command palette with PR context

## Summary

The PR listing fetches data via two GraphQL fragments (`SUMMARY_FIELDS_FRAGMENT` for list pages, `DETAIL_FIELDS_FRAGMENT` for single-PR hydration) executed through `gh api graphql`. The domain type `PullRequestItem` (domain.ts:L134) is the single canonical shape used everywhere — UI, cache, atoms. Grouping today is strictly by repository (App.tsx:L449). To support GitHub inbox-style grouping (needs review / approved / changes requested / draft) and status chips (conflict, comment count, assignees), the main changes would be:

1. **GraphQL fragments** (GitHubService.ts:L226+L242): add `updatedAt`, `mergeable`, `reviewRequests`, `latestOpinionatedReviews`, `totalCommentsCount`, `assignees`.
2. **Domain type** (domain.ts:L134): add corresponding fields to `PullRequestItem` (and consider preserving `isDraft` as a standalone field).
3. **Cache schema** (CacheService.ts:L40): extend `CachedPullRequestItemSchema` for new fields with backwards-compatible defaults.
4. **Parsers** (GitHubService.ts:L413+L440): map new raw fields.
5. **Tests to expand**: `githubServiceQueries.test.ts` (parser tests, `makeSummaryNode`/`makeDetailNode` fixtures), `cacheService.test.ts` (round-trip with new fields), `pullRequestsDisplay.test.ts` and `pullRequestList.test.ts` (new grouping/chip rendering).
