# Codebase Research: GitHub Comments API Surface

## Research Question
What GitHub APIs do the comment-related methods in `GitHubService` call, what fields do they fetch, and what threading/resolution capabilities exist across terminal vs Electron UIs?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `listPullRequestComments` | 5 files | Core service + electron bridge + mock |
| 2 | `listPullRequestReviewComments` | 3 files | Core service + mock |
| 3 | `replyToReviewComment` | 3 files | Core service + mock |
| 4 | `PullRequestReviewComment` in domain.ts | 2 matches | Interface + union member |
| 5 | `buildThreads` in electron | 2 matches | Function def + usage |
| 6 | `orderCommentsForDisplay` | 0 in electron, found in `src/ui/CommentsPane.tsx` | Terminal only |
| 7 | `resolveReviewThread\|resolve.*thread\|thread.*resolve` | 0 files | **No thread resolution exists** |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/core/src/services/GitHubService.ts` | All API methods | L164-183 (schema), L570-612 (parsing), L868-885 (list methods), L961-985 (reply) |
| 2 | `packages/core/src/domain.ts` | `PullRequestReviewComment` type | L110-120 |
| 3 | `packages/electron/src/renderer/components/CommentsPane.tsx` | Electron `buildThreads` | L16-35 |
| 4 | `src/ui/CommentsPane.tsx` | Terminal `orderCommentsForDisplay` | L95-133 |

## Findings

### 1. `listPullRequestReviewComments` (L868-871)

```ts
const listPullRequestReviewComments = (repository: string, number: number) =>
    ghJson("listPullRequestReviewComments", CommentsResponseSchema,
        ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${number}/comments`])
    .pipe(Effect.map(parsePullRequestComments))
```

- **API**: `GET /repos/{owner}/{repo}/pulls/{number}/comments` (REST, paginated)
- **Returns**: `PullRequestReviewComment[]`
- **Schema fields fetched** (L164-183): `id`, `node_id`, `body`, `html_url`, `url`, `created_at`, `user.login`, `path`, `line`, `original_line`, `side`, `in_reply_to_id`
- **Does NOT fetch**: `outdated`, `subject_type` (not in schema at all)

### 2. `listPullRequestComments` (L873-885)

```ts
const listPullRequestComments = Effect.fn("GitHubService.listPullRequestComments")(
    function* (repository: string, number: number) {
        const [issueComments, reviewComments] = yield* Effect.all([
            ghJson(..., `repos/${repository}/issues/${number}/comments`).pipe(Effect.map(parseIssueComments)),
            listPullRequestReviewComments(repository, number).pipe(Effect.map(comments => comments.map(reviewCommentAsComment))),
        ], { concurrency: "unbounded" })
        return sortComments([...issueComments, ...reviewComments])
    })
```

- **APIs called**: Both `GET /repos/{owner}/{repo}/issues/{number}/comments` (issue comments) AND `GET /repos/{owner}/{repo}/pulls/{number}/comments` (review comments)
- **Yes**, it returns both issue comments AND review comments, merged and sorted by `createdAt`.

### 3. `replyToReviewComment` (L961-985)

```ts
const replyToReviewComment = Effect.fn("GitHubService.replyToReviewComment")(
    function* (repository: string, number: number, inReplyTo: string, body: string) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
            "api", "--method", "POST",
            `repos/${repository}/pulls/${number}/comments/${inReplyTo}/replies`,
            "-f", `body=${body}`,
        ])
        ...
    })
```

- **API**: `POST /repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies`

### 4. `PullRequestReviewComment` type (domain.ts L110-120)

```ts
export interface PullRequestReviewComment {
    readonly id: string
    readonly path: string
    readonly line: number
    readonly side: DiffCommentSide
    readonly author: string
    readonly body: string
    readonly createdAt: Date | null
    readonly url: string | null
    readonly inReplyTo: string | null
}
```

- **No `outdated` field**
- **No `subjectType` field**
- The GitHub REST API returns `outdated` and `subject_type` on review comments, but they are not in the schema and not parsed.

### 5. Electron `buildThreads` vs Terminal `orderCommentsForDisplay`

**Electron `buildThreads`** (CommentsPane.tsx L16-35):
- Groups review comments by `inReplyTo` chain into threads
- Simple forward-pass: if a comment has `inReplyTo` and the parent thread exists in `replyMap`, appends to that thread
- **Does NOT** handle issue comment quote-reply threading
- **No indentation** tracking (flat thread arrays)
- If a reply's parent hasn't been seen yet (out-of-order), it becomes a new root thread

**Terminal `orderCommentsForDisplay`** (src/ui/CommentsPane.tsx L95-133):
- Builds a parent-child tree using **both** `inReplyTo` (for review comments) AND a quote-header heuristic (`issueQuoteParent`, L60-84) for issue comments
- Issue comments that start with `> @author wrote:` are matched to their parent by comparing collapsed body text
- Produces `OrderedComment[]` with `indent` levels (capped at `MAX_INDENT_LEVELS`)
- DFS traversal from roots, children sorted by time
- Cycle-safe via `visited` set

**What Electron misses**:
1. No issue-comment quote-reply threading (the `issueQuoteParent` heuristic)
2. No indentation/nesting depth tracking
3. No DFS ordering (just linear grouping)

### 6. Thread Resolution

**No `resolveReviewThread` method exists anywhere in the codebase.** GitHub provides a `resolveReviewThread` GraphQL mutation, but it is not implemented in `GitHubService`.

## Summary

`GitHubService` fetches both issue and review comments via REST but omits `outdated` and `subject_type` fields from the schema. The Electron `buildThreads` is significantly simpler than the terminal's `orderCommentsForDisplay`, missing issue-comment quote-threading and indentation. There is no thread resolution capability anywhere in the codebase.
