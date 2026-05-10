# GitHub inbox-style PR list plan

## Status

Revised after reviewer feedback.

## Problem Summary

ghui currently renders pull requests as a single list for either a repository view or one of four queue modes (`authored`, `review`, `assigned`, `mentioned`), then groups the visible rows by repository (`packages/core/src/pullRequestViews.ts:3-30`, `src/App.tsx:449-451`, `src/ui/PullRequestList.tsx:49-87`). That is materially different from GitHub’s web PR inbox, which is organized into action-oriented sections such as “Needs your review,” “Your drafts,” and “Needs action,” with richer row metadata and an updated-time filter.

The requested change is to let ghui show pull requests more like the GitHub web UI, while defaulting the updated filter to the last month. That updated window does not need to change live at runtime, but it should be configurable from startup configuration.

## Acceptance Criteria

- ghui gains a dedicated `Inbox` view that renders grouped sections for `Needs your review`, `Your drafts`, `Waiting for review`, `Needs action`, and `Ready to merge`.
- Inbox rows render richer metadata than the current one-line queue rows, including repository/number context, author, relative updated time, and status/comment signals derived from GitHub data already fetched by the app.
- Inbox results default to PRs updated within the last month, with a startup-only env override; there is no requirement for a runtime-updatable dropdown in v1.
- Existing `repository`, `authored`, `review`, `assigned`, and `mentioned` views remain available and keep their current pagination and sort behavior.
- `Needs your teams' review`, exact github.com collapse/expand behavior, and a runtime-updatable updated-window control are out of scope for v1.

## Current Code Context

### Existing PR view and fetch model

- The core view model only knows two shapes today: `Repository` and `Queue` (`packages/core/src/pullRequestViews.ts:3-5`). Queue views are constrained to the hard-coded `pullRequestQueueModes` array (`packages/core/src/domain.ts:8-10`).
- `pullRequestsAtom` drives every list load. It reads `activeViewAtom`, resolves one `mode` + `repository`, loads one page through `GitHubService.listOpenPullRequestPage`, merges cached details, and stores a flat `PullRequestLoad` with a single `endCursor` / `hasNextPage` pair (`src/App.tsx:290-350`, `packages/core/src/pullRequestLoad.ts:4-9`).
- `GitHubService.listOpenPullRequestPage` is a single-query API today: repository mode uses `repository.pullRequests`, while queue modes use GitHub search (`packages/core/src/services/GitHubService.ts:650-682`).
- Queue search strings are built by `searchQuery(mode, repository)`, which currently appends `sort:created-desc` for queue views and has no `updated:` qualifier at all (`packages/core/src/services/GitHubService.ts:459-462`).

### Current row shape is repository-grouped, single-line, and based on created time

- `visibleGroupsAtom` always groups PRs by `pullRequest.repository` (`src/App.tsx:443-451`).
- `PullRequestListRow` only supports repository-style `group` rows plus PR rows and an optional load-more footer (`src/ui/PullRequestList.tsx:10-16`).
- `buildPullRequestListRows` flattens group headers and PR rows into one list, but the group header model assumes a repository label rather than an action-oriented inbox section (`src/ui/PullRequestList.tsx:49-87`).
- Each PR row shows a single line using `daysOpen(pullRequest.createdAt)` rather than relative updated time (`src/ui/PullRequestList.tsx:95-138`, `packages/core/src/date.ts:7-17`).

### Current GraphQL data is not rich enough for a GitHub-style inbox row

- The list query fragments fetch `number`, `title`, `isDraft`, `reviewDecision`, `autoMergeRequest`, `state`, `createdAt`, `closedAt`, `url`, `author`, branch info, repository name, and `statusCheckRollup` (`packages/core/src/services/GitHubService.ts:226-261`).
- The canonical `PullRequestItem` discards or does not expose several fields that would be useful for GitHub-style grouping and row metadata, including `updatedAt`, explicit `isDraft`, comment counts, assignees, review-request details, and mergeability (`packages/core/src/domain.ts:134-156`).
- The current row rendering only consumes review/check rollups, title, number, repository, URL, and created time (`src/ui/pullRequests.ts:15-80`, `src/ui/PullRequestList.tsx:116-136`).
- GitHub’s `PullRequest` GraphQL object does expose the fields needed for a richer inbox row, including `updatedAt`, `totalCommentsCount`, `reviewRequests`, `latestOpinionatedReviews`, `assignees`, `mergeable`, `isDraft`, `reviewDecision`, `statusCheckRollup`, and `autoMergeRequest` (GitHub GraphQL PullRequest docs, requested by the issue).

### Config currently comes from env-backed AppConfig, while config.json is theme-only

- `AppConfig` only contains `prFetchLimit`, `prPageSize`, and `cachePath` and is resolved from env vars in `packages/core/src/config.ts:17-35`.
- `App.tsx` resolves that config once at startup and threads it into `makeCoreLayer` (`src/App.tsx:194-202`, `packages/core/src/runtime.ts:12-29`).
- There is already a `~/.config/ghui/config.json` file surface, but it is used only for theme/diff settings via `themeStore.ts` (`packages/core/src/themeStore.ts:9-41`).
- There is no existing concept of an updated-since window in either config surface (`packages/core/src/config.ts:25-29`, `packages/core/src/services/GitHubService.ts:459-462`).

### Cache, commands, and mock data all assume today’s simpler view model

- `CacheService` serializes `PullRequestView` as `Queue | Repository` and stores cached `PullRequestItem`s via `CachedPullRequestViewSchema` and `CachedPullRequestItemSchema` (`packages/core/src/services/CacheService.ts:40-67`).
- View-switch commands are auto-generated from `activePullRequestViews(activeView)` and therefore assume the current view union and labels (`packages/core/src/appCommands.ts:170-188`).
- The keyboard surface only cycles through the current active view list (`src/keymap/listNav.ts:42-44`, `src/App.tsx:1118-1138`).
- Mock mode does not distinguish queue semantics today: every non-repository view returns the same items (`packages/core/src/services/MockGitHubService.ts:91-94`).

## Proposed Changes

### 1. Add a dedicated `Inbox` view instead of overloading the existing queue modes

Introduce a third `PullRequestView` variant, `Inbox`, rather than trying to fake the GitHub web inbox as another queue mode.

Why this should be a distinct view:

- The current queue path assumes one query, one cursor, and repository grouping (`src/App.tsx:290-350`, `src/App.tsx:449-451`, `packages/core/src/pullRequestLoad.ts:4-9`).
- A GitHub-style inbox is a composite of multiple logical buckets, with fixed section ordering and bucket-specific query rules, so it does not map cleanly onto the current `mode` abstraction.

Planned touch points:

- Extend `PullRequestView` helpers (`packages/core/src/pullRequestViews.ts:3-30`) with `Inbox` branches for `viewCacheKey`, `viewEquals`, `viewLabel`, and `activePullRequestViews`.
- Update `CacheService` view decoding so cached queue snapshots can store/read the new `_tag` (`packages/core/src/services/CacheService.ts:64-67`).
- Add an `inbox` command/view entry via the existing generated view-command path (`packages/core/src/appCommands.ts:178-188`).
- Keep the current repository/authored/review/assigned/mentioned views available so this ships as an additive view model, not a destructive rewrite.

### 2. Load the inbox by composing several GitHub search queries, not by inventing a new transport

Continue using the existing `gh api graphql` transport through `GitHubService`, but add a dedicated inbox loader that executes multiple search queries and merges them into sectioned results.

Recommended v1 section model:

1. `Needs your review`
2. `Your drafts`
3. `Waiting for review`
4. `Needs action`
5. `Ready to merge`

`Needs your teams' review` is explicitly out of scope for v1. The repo has no team-membership discovery or team-config mechanism today, so promising GitHub parity there would introduce unresolved product and configuration work before the main inbox view even ships (`packages/core/src/themeStore.ts:18-41`).

Recommended query strategy:

- Reuse GitHub search qualifiers rather than trying to reverse-engineer an internal GitHub endpoint.
- Build one search per section, each sorted by `updated-desc`, each filtered to open PRs, and each constrained by the configured updated-since cutoff.
- Execute those searches in **one aliased GraphQL request** rather than firing five separate `gh api graphql` commands. That keeps the transport model the same while avoiding a 5x command/rate-limit multiplier (`packages/core/src/services/GitHubService.ts:632-643`, `_findings/codebase-research-pr-queries.md:143-156`).
- Merge/dedupe the combined results with a **defined precedence order** so one PR renders in exactly one section.

Representative section query shapes for planning purposes:

- `Needs your review`: `is:pr is:open review-requested:@me updated:>=<cutoff> sort:updated-desc`
- `Your drafts`: `is:pr is:open author:@me draft:true updated:>=<cutoff> sort:updated-desc`
- `Waiting for review`: broad authored search (`is:pr is:open author:@me draft:false updated:>=<cutoff> sort:updated-desc`), then client-side classification using `reviewDecision`, `isDraft`, and the section precedence rules below
- `Needs action`: `is:pr is:open author:@me review:changes_requested updated:>=<cutoff> sort:updated-desc`
- `Ready to merge`: broad authored search (`is:pr is:open author:@me draft:false updated:>=<cutoff> sort:updated-desc`), then client-side classification using `reviewDecision`, check rollup, and draft state

Important query-semantics decisions:

- Do **not** rely on negated `review:` search qualifiers for `Waiting for review`; reviewer feedback correctly called out that this is not a safe way to express “awaiting review.” The authoritative assignment should happen client-side after fetch, using GraphQL fields the app already parses or will add (`packages/core/src/services/GitHubService.ts:226-261`).
- Do **not** rely on `status:success` for `Ready to merge`; GitHub search `status:` is tied to commit status semantics and can miss modern check-run-only repos. The implementation should instead use the already-planned `statusCheckRollup`-derived `checkStatus` from the fetched PR data (`packages/core/src/services/GitHubService.ts:215-240`, `packages/core/src/services/GitHubService.ts:368-410`).

Inbox section precedence must be explicit in the implementation and tests. For v1, classify each PR into exactly one section using this order:

1. `Needs your review`
2. `Your drafts`
3. `Needs action`
4. `Ready to merge`
5. `Waiting for review`

That precedence keeps action-required states ahead of passive authored states and avoids double-rendering when a PR matches multiple broad searches.

Implementation note for scope control: inbox v1 should **not** reuse the current single-cursor load-more path. The composite inbox loader should fetch each section to a configured cap and return `hasNextPage = false` for inbox loads, leaving the existing load-more footer only on legacy repository/queue views (`src/ui/PullRequestList.tsx:83-85`, `src/App.tsx:1139-1147`).

One additional implementation note: the inbox fetch path should keep its own section-assignment data in memory and treat the cached `PullRequestLoad.data` array as the source PR set. On cache read, sections should be re-derived from the cached PR fields rather than persisted as a second serialized structure. That avoids a deeper cache-schema redesign while still allowing the new `Inbox` view tag in cached queue snapshots (`packages/core/src/services/CacheService.ts:271-349`).

### 3. Extend `PullRequestItem` and GraphQL parsing for inbox-grade row data

Expand the core PR summary shape so the inbox view has enough data to render GitHub-style rows and to assign section precedence cleanly.

Recommended additions to `PullRequestItem` / list query fragments:

- `updatedAt: Date`
- `isDraft: boolean` (preserve the raw field rather than only deriving `reviewStatus`)
- `totalCommentsCount: number`
- `mergeable: Mergeable | null` or equivalent normalized enum
- `assignees: readonly string[]`
- `reviewRequests: readonly { readonly type: "user" | "team"; readonly name: string }[]`
- optionally `latestOpinionatedReviews` in a normalized form if the final section rules need more reviewer detail than `reviewDecision`

Concrete change points:

- Extend `SUMMARY_FIELDS_FRAGMENT` / `DETAIL_FIELDS_FRAGMENT` in `packages/core/src/services/GitHubService.ts:226-261`.
- Update `parsePullRequestSummary` / `parsePullRequest` to preserve the new fields (`packages/core/src/services/GitHubService.ts:413-457`).
- Keep `CachedPullRequestItemSchema`, encode/decode helpers, and cache round-trips in sync with backwards-compatible defaults (`packages/core/src/services/CacheService.ts:40-62`, `packages/core/src/services/CacheService.ts:102-154`). Concretely, any newly added cached fields must decode safely from pre-upgrade rows by using optional schema keys and domain defaults rather than by making the new fields immediately required.

### 4. Make list grouping view-aware and teach the list UI about inbox sections

Generalize the list pipeline so legacy views keep repository grouping, while the new inbox view groups by action section.

Planned UI/data changes:

- Introduce a small inbox section model (for example `InboxSection` plus ordered metadata like title and sort priority) in core or a dedicated shared list-view module.
- Change `visibleGroupsAtom` from “always group by repository” to “group by repository for legacy views, group by inbox section for inbox view” (`src/App.tsx:443-451`).
- Generalize `PullRequestListRow["group"]` so a group header can represent a repository **or** an inbox section with a badge count (`src/ui/PullRequestList.tsx:10-16`, `src/ui/PullRequestList.tsx:77-81`, `src/ui/PullRequestList.tsx:188`).
- Keep PR rows themselves selectable while leaving group headers non-selectable in v1. That preserves the current `selectedIndex -> visiblePullRequests` mapping and avoids rewriting the scroll/selection system (`src/App.tsx:451-467`, `src/App.tsx:973-987`, `src/App.tsx:1371-1378`).

### 5. Update the row layout to look like a GitHub inbox row instead of the current single-line queue row

The current row is a compact TUI queue row, not a GitHub-like inbox row (`src/ui/PullRequestList.tsx:95-138`). The inbox view should adopt a richer row shape:

- primary line: title
- secondary line: `repo#number • author • updated <relative>`
- right-side or inline metadata: review state, check summary, comment count, and optionally mergeability / auto-merge cues

Recommended scope split:

- Reuse existing review/check icon and status-color logic where possible (`src/ui/pullRequests.ts:35-80`).
- Switch age display from `createdAt` to `updatedAt`, using a relative formatter rather than the current `daysOpen(createdAt)` integer (`packages/core/src/date.ts:7-17`, `src/ui/PullRequestList.tsx:116-136`).
- Do **not** promise perfect control-bar or collapse/expand parity with github.com in v1 unless the human explicitly wants that. The essential user-facing parity is the grouped inbox sections and richer row metadata.

### 6. Add a startup-only updated-since setting with a “last month” default

Add a first-class inbox filter window to app config.

Recommended config model:

- New app-config field, for example `prUpdatedSinceWindow`, with logical values like `"1m" | "3m" | "1y" | "any"`.
- Default to `"1m"` so the inbox behaves like GitHub’s “Updated: Last month” default.
- Expose an env override (for example `GHUI_PR_UPDATED_SINCE=1m|3m|1y|any`) through `resolveAppConfig()` (`packages/core/src/config.ts:17-35`).

For v1, keep this **env-backed only**. Reviewer feedback correctly pointed out that `AppConfig` is currently resolved through Effect `Config` while `config.json` is a separate theme-only system (`packages/core/src/config.ts:25-35`, `packages/core/src/themeStore.ts:27-41`, `_findings/codebase-research-appconfig-and-updated-since.md:63-89`). Unifying those systems would be a meaningful refactor and is not necessary to satisfy the user’s “config file or env variable” requirement.

Then teach the new inbox query builder to translate the logical window into an ISO date for GitHub’s documented `updated:` search qualifier. This filter should apply to the new inbox searches only; existing repository/queue views should keep their current query semantics and `sort:created-desc` / repository ordering behavior (`packages/core/src/services/GitHubService.ts:459-462`).

### 7. Keep mock mode, commands, and tests aligned with the new view

- Extend `MockGitHubService` so inbox view/mock mode produces sectioned data that looks different from legacy queue views (`packages/core/src/services/MockGitHubService.ts:49-94`).
- Ensure command-palette view switching exposes the new inbox view cleanly and that header labels remain correct (`packages/core/src/appCommands.ts:170-188`, `src/App.tsx:1060-1066`).
- Add or update tests for query building/parsing, cache round-trips, config precedence, and list-row grouping/rendering.

## Verification Plan

1. **Core query/config tests**
   - Extend `packages/core/test/githubServiceQueries.test.ts` to assert the new GraphQL fields are parsed and the inbox search queries include `updated:>=...` plus `sort:updated-desc`.
   - Add dedicated tests for the inbox section-classification and dedup-precedence rules, since that merge logic is the most error-prone part of the design.
   - Add tests covering the startup config window default and env override behavior (`packages/core/src/config.ts:17-35`).

2. **Domain/cache tests**
   - Update `packages/core/test/cacheService.test.ts` so round-tripped cached PRs preserve the new inbox-relevant fields and the new `Inbox` view decodes from cached queue snapshots (`packages/core/src/services/CacheService.ts:40-67`, `packages/core/src/services/CacheService.ts:271-349`).
   - Add an upgrade-compatibility test proving that cached rows written before the new inbox fields still decode successfully with schema defaults.
   - Update `packages/core/test/domain.test.ts` or add a dedicated inbox-section test file for section precedence / grouping helpers.

3. **UI list tests**
   - Extend `test/pullRequestList.test.ts` to verify inbox section headers, counts, and the absence of the legacy load-more footer on inbox loads (`src/ui/PullRequestList.tsx:49-87`).
   - Extend `test/pullRequestsDisplay.test.ts` to cover updated-time rendering, comment-count display, and any new status chips (`src/ui/pullRequests.ts:15-80`).

4. **Manual smoke checks**
   - Run ghui against mock data and a real GitHub account to confirm the new inbox view renders the expected section order and uses the last-month cutoff by default.
   - Verify the existing repository/authored/review/assigned/mentioned views still work, still page, and still preserve selection/scroll behavior.

## Risks / Open Questions

1. **Should inbox v1 support load-more pagination?**
   - The current list model has one `endCursor` / `hasNextPage` pair (`packages/core/src/pullRequestLoad.ts:4-9`), which is a poor fit for six independently paginated search queries.
   - Recommended answer: no load-more for inbox v1; keep paging on legacy views only.

2. **How exact should the row chrome match github.com?**
   - The plan above targets grouped sections plus richer metadata, but not necessarily exact collapse/expand behavior or every control in the top filter bar.
   - If exact collapse behavior is part of the acceptance criteria, that should be called out before implementation because it affects list selection semantics and group-header interaction.

3. **`Needs your review` will still inherit GitHub search semantics**
   - Search-based review-request buckets depend on GitHub’s own `review-requested:@me` behavior. Once a review is submitted, GitHub may remove the explicit review request, so this view may not exactly match every nuance of the website’s internal inbox logic.
   - Recommended answer: accept GitHub search semantics for v1 and document any mismatch rather than block the feature on reverse-engineering non-public web behavior.

4. **App.tsx remains a high-touch integration point**
   - The current list/view orchestration is concentrated in `App.tsx` (`src/App.tsx:290-350`, `src/App.tsx:443-451`, `src/App.tsx:953-987`, `src/App.tsx:1118-1147`).
   - Recommended answer: keep the refactor narrowly scoped to the inbox work unless implementation reveals the need to extract view/grouping atoms into a dedicated module.

## Relevant Files / Research References

### Key code references

- `packages/core/src/domain.ts:8-30`, `packages/core/src/domain.ts:134-183`
- `packages/core/src/pullRequestViews.ts:3-30`
- `packages/core/src/pullRequestLoad.ts:4-9`
- `packages/core/src/config.ts:17-35`
- `packages/core/src/runtime.ts:12-29`
- `packages/core/src/services/GitHubService.ts:226-261`, `packages/core/src/services/GitHubService.ts:413-462`, `packages/core/src/services/GitHubService.ts:650-707`
- `packages/core/src/services/CacheService.ts:40-67`, `packages/core/src/services/CacheService.ts:102-170`, `packages/core/src/services/CacheService.ts:220-349`
- `packages/core/src/services/MockGitHubService.ts:49-105`
- `packages/core/src/themeStore.ts:9-41`
- `packages/core/src/appCommands.ts:170-197`
- `packages/core/src/date.ts:7-17`
- `src/App.tsx:194-202`, `src/App.tsx:290-350`, `src/App.tsx:443-451`, `src/App.tsx:953-987`, `src/App.tsx:1060-1066`, `src/App.tsx:1118-1147`, `src/App.tsx:1371-1378`
- `src/ui/PullRequestList.tsx:10-16`, `src/ui/PullRequestList.tsx:49-87`, `src/ui/PullRequestList.tsx:95-138`, `src/ui/PullRequestList.tsx:141-209`
- `src/ui/pullRequests.ts:15-80`, `src/ui/pullRequests.ts:105-126`
- `src/keymap/listNav.ts:42-44`

### Test references

- `packages/core/test/githubServiceQueries.test.ts:18-22`, `packages/core/test/githubServiceQueries.test.ts:312-443`
- `packages/core/test/domain.test.ts:4-39`
- `packages/core/test/cacheService.test.ts:24-89`
- `packages/core/test/themeStore.test.ts:25-58`
- `test/pullRequestList.test.ts:30-60`
- `test/pullRequestsDisplay.test.ts:30-149`

### Research artifacts

- `_findings/codebase-research-pr-queries.md`
- `_findings/codebase-research-pr-list-inbox-architecture.md`
- `_findings/codebase-research-appconfig-and-updated-since.md`
- `_findings/codebase-research-pr-listing-graphql-surface.md`
- `_findings/codebase-research-command-keymap-view-surface.md`
