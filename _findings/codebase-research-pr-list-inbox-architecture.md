# Codebase Research: PR List & Inbox/Grouped List Architecture

## Research Question
How is the PR list data fetched, how are queue/repository views modeled, how is the list UI rendered, and where could a GitHub web-style inbox/grouped list plug in?

## Search Trail

| # | Query | Files | Notes |
|---|-------|-------|-------|
| 1 | `PrList\|PullRequestList` | 4 | Core UI component + test |
| 2 | `fetchPr\|listPull\|pullRequests` | 24 | GitHubService, CacheService, MockGitHubService |
| 3 | `queue\|Queue\|inbox\|Inbox` | 143 | Queue is pervasive; no inbox concept exists yet |
| 4 | `PullRequestView\|pullRequestQueueModes\|viewMode` | 48 | Domain + views + App wiring |
| 5 | `groupBy\|PullRequestGroups` | 9 | Grouping logic in pullRequests.ts, consumed in App.tsx |
| 6 | `switchQueueMode\|activeView\|viewLabel` | 23 | View switching in App.tsx |

## Relevant Files

| # | File | Relevance | Key Lines |
|---|------|-----------|-----------|
| 1 | `packages/core/src/domain.ts` | Queue modes, search qualifiers | L8-30 |
| 2 | `packages/core/src/pullRequestViews.ts` | `PullRequestView` union type, view navigation | L1-42 |
| 3 | `packages/core/src/pullRequestLoad.ts` | `PullRequestLoad` shape (data + pagination) | L1-10 |
| 4 | `packages/core/src/services/GitHubService.ts` | GraphQL fetch: `listOpenPullRequestPage`, `searchQuery()` | L459-707 |
| 5 | `packages/core/src/services/CacheService.ts` | SQLite cache: `readQueue`/`writeQueue`, `PullRequestView` schema | L64-65, L207+, L271+, L368 |
| 6 | `src/ui/pullRequests.ts` | `groupBy()`, row display helpers, `PullRequestRowDisplay` | L59-81, L105-126 |
| 7 | `src/ui/PullRequestList.tsx` | `PullRequestListRow` union, `buildPullRequestListRows`, `PullRequestList` component | L10-210 |
| 8 | `src/App.tsx` | All wiring: atoms, view switching, filtering, grouping, rendering | L281-490 (atoms), L960-987 (rows), L1065 (header), L1136-1179 (switchQueueMode/loadMore), L3493-3530 (layout) |
| 9 | `packages/core/src/appCommands.ts` | Command palette entries for switching views | L184 |
| 10 | `src/ui/primitives.tsx` | `SectionTitle` component used as list header | L120 |

## Code Path Map

### Data Fetch: `pullRequestsAtom` → GitHub GraphQL → cache

1. **`activeViewAtom`** (`App.tsx:281`) holds the current `PullRequestView` (either `{_tag: "Queue", mode, repository}` or `{_tag: "Repository", repository}`).
2. **`pullRequestsAtom`** (`App.tsx:290-354`) is an Effect atom that:
   - Reads `activeViewAtom` to get current view
   - Calls `cacheService.readQueue()` to warm from SQLite (L302)
   - Calls `github.listOpenPullRequestPage()` with mode/repository/cursor/pageSize (L310-315)
   - Merges cached detail data with fresh summary data (L337)
   - Stores result in `queueLoadCacheAtom` and persists to SQLite (L348-349)
3. **`GitHubService.listOpenPullRequestPage`** (`GitHubService.ts:677-682`):
   - Repository mode → `listRepositoryPullRequestPage` (dedicated GraphQL query with `repository.pullRequests`)
   - Queue modes → `listOpenPullRequestSearchPage` (GitHub Search API via GraphQL `search` field)
   - Search query built by `searchQuery()` (L459-462): `pullRequestQueueSearchQualifier(mode) is:pr is:open sort:...`
4. **`searchQuery`** delegates to `pullRequestQueueSearchQualifier` (`domain.ts:20-30`): maps mode to `author:@me`, `review-requested:@me`, `assignee:@me`, `mentions:@me`, or `repo:owner/name`.

### View Model: `PullRequestView` and Navigation

1. **`PullRequestView`** (`pullRequestViews.ts:3-5`): discriminated union — `Queue` (with `PullRequestUserQueueMode` + optional repository) or `Repository` (with repository string).
2. **Available modes**: `["authored", "review", "assigned", "mentioned"]` (`domain.ts:8`). Plus synthetic `"repository"` mode.
3. **`activePullRequestViews`** (`pullRequestViews.ts:17-20`): generates the tab list — if a repository is set, prepends a Repository view, then all Queue modes scoped to that repository.
4. **`switchQueueMode`** (`App.tsx:1136-1138`): cycles through `activeViews` using `nextView()`.
5. **`switchViewTo`** (`App.tsx:1119-1134`): persists selection, resets UI state, triggers fetch.
6. **Header display**: `viewLabel(activeView)` shown in header bar (`App.tsx:1065`).

### Grouping & Filtering: atoms → `PullRequestGroups`

1. **`displayedPullRequestsAtom`** (`App.tsx:415-426`): raw PR list with overrides and recently-completed PRs merged in.
2. **`filteredPullRequestsAtom`** (`App.tsx:430-441`): applies filter query with scoring.
3. **`visibleGroupsAtom`** (`App.tsx:449`): calls `groupBy(filteredPRs, pr => pr.repository, repoOrder)` → produces `Array<[repoName, PullRequestItem[]]>`.
4. **`groupBy`** (`pullRequests.ts:105-126`): generic group-by with ordered-key sorting.

### List Rendering: `PullRequestList` component

1. **`PullRequestListRow`** (`PullRequestList.tsx:10-16`): tagged union with 6 variants: `title`, `filter`, `message`, `group`, `pull-request`, `load-more`.
2. **`buildPullRequestListRows`** (`PullRequestList.tsx:49-87`): flattens groups into a row array — title row, optional filter bar, group headers interleaved with PR rows, optional load-more row.
3. **`PullRequestList`** component (`PullRequestList.tsx:141-209`): maps rows to JSX. Group headers use `GroupTitle` with repo color. PR rows use `PullRequestRow` with review/check icons, age, number.
4. **Layout** (`App.tsx:3493-3530`): `widePullRequestList` and `narrowPullRequestList` variants, wrapped in scroll containers when needed.
5. **Selection**: `selectedIndexAtom` tracks flat index into `visiblePullRequests`; `queueSelectionAtom` persists per-view selections.

## Architectural Context

- **Module structure**: `packages/core/` has domain types, services (GitHubService, CacheService); `src/` has React UI (OpenTUI-based terminal UI).
- **State management**: Effect-TS atoms (`Atom.make`, `Atom.keepAlive`). React hooks via `useAtom`/`useAtomValue`.
- **Data flow**: `activeViewAtom` → `pullRequestsAtom` (Effect fetch) → `queueLoadCacheAtom` → `displayedPullRequestsAtom` → `filteredPullRequestsAtom` → `visibleGroupsAtom` → `buildPullRequestListRows` → `PullRequestList` component.
- **Caching**: SQLite via `CacheService`. Queue snapshots keyed by viewer + view. PR details cached individually.
- **Related tests**: `test/pullRequestList.test.ts`, `test/pullRequestsDisplay.test.ts`, `packages/core/test/cacheService.test.ts`, `packages/core/test/domain.test.ts`.
- **Existing plans**: `plans/queued-reviews.md` (pending review batching — different from inbox).

## Change Points for an Inbox/Grouped List Feature

### 1. New View Variant
- **`PullRequestView`** (`pullRequestViews.ts:3-5`): add a third union member, e.g. `{_tag: "Inbox"}`. This is the biggest structural change — it ripples through `viewMode`, `viewCacheKey`, `viewLabel`, `activePullRequestViews`, and `CachedPullRequestViewSchema`.
- **`CacheService`** (`CacheService.ts:64-65`): `CachedPullRequestViewSchema` must handle the new tag.

### 2. Different Fetch Strategy
- GitHub's inbox-style grouping (notifications, review requests across repos) may need the **Notifications API** or multiple parallel queue-mode fetches rather than a single search query.
- **`GitHubService`** (`GitHubService.ts`): new method, or a composite that merges results from multiple `listOpenPullRequestPage` calls.

### 3. Different Grouping Logic
- Current grouping is always by repository (`visibleGroupsAtom` at `App.tsx:449`).
- Inbox view would group by "reason" (review requested, mentioned, authored, assigned) or by "action needed" category.
- **`groupBy`** (`pullRequests.ts:105-126`) is generic and reusable — just pass a different `getKey` function.
- **`visibleGroupsAtom`** would need to be view-aware (branch on `activeView._tag`).

### 4. Row Model Extension
- **`PullRequestListRow`** (`PullRequestList.tsx:10-16`): may need a new group header variant (e.g. with an icon/description instead of repo color diamond).
- Or the existing `group` row could be generalized to accept a label + style rather than assuming a repository name.

### 5. Selection/Cache Keying
- **`queueLoadCacheAtom`** and **`queueSelectionAtom`** (`App.tsx:282-283`): keyed by `viewCacheKey`. An inbox view just needs a distinct cache key.

### Risks
- **App.tsx is ~4000 lines** with deeply intertwined atom/component logic. Any view-level change touches many spots (counted 20+ references to `activeView`/`currentQueueCacheKey`).
- **`PullRequestView` is a discriminated union** used in serialization (`CachedPullRequestViewSchema`). Adding a variant requires migration handling for existing cached data.
- **GitHub API limitations**: there's no single "inbox" endpoint that matches the web UI's grouped notification view. The web UI uses internal APIs. A TUI equivalent would need to composite from notifications + search, introducing latency and complexity.
- **`groupBy` key ordering**: the current `orderedKeys` approach preserves filter-match order. An inbox grouping would want a fixed category order instead.

## Summary

The PR list flow is: `PullRequestView` (discriminated union: Queue or Repository) → `pullRequestsAtom` (Effect-based fetch via `gh api graphql` search) → `queueLoadCacheAtom` (in-memory + SQLite) → filtering → `groupBy` by repository → `buildPullRequestListRows` (flat row array) → `PullRequestList` React component. Views are switched via `switchQueueMode`/`switchViewTo` which persist selection and trigger re-fetch. An inbox feature would primarily need: (1) a new `PullRequestView` variant, (2) a composite fetch strategy, (3) a different grouping key function, and (4) possibly extended row types for non-repo group headers. The main risk is the size and coupling of `App.tsx` (~4K lines, 20+ references to view-related atoms).
