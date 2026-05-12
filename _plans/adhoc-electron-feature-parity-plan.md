# Electron App Feature Parity & Comment Threads Plan

## Problem Summary

The Electron app (`packages/electron`) was built to the spec in `_plans/adhoc-electron-app-plan.md` and is functional, but is missing several features compared to the terminal TUI (`src/App.tsx`). Additionally the comment viewing experience has correctness bugs and needs new capabilities:

1. **Feature parity gaps** — Submit review, label management, inbox tab, rendered markdown body, and load-more pagination are absent from the Electron UI.
2. **Comment threading bugs** — The Electron `buildThreads` function is a simplified linear grouper that misses issue-comment quote-reply threading and produces no indentation depth. The terminal's `orderCommentsForDisplay` has this logic and should be ported.
3. **Reply/edit/delete routing bugs** — `CommentsPane` always calls `createIssueComment` on reply (wrong for review threads) and always calls `editReviewComment`/`deleteReviewComment` for edits/deletes (wrong for issue comments).
4. **Outdated thread coherence** — GitHub marks review comment threads as "outdated" when the PR head advances. The `outdated` field is available in the GitHub REST response but is not currently fetched or rendered. The requirement is to show ALL unresolved threads, including outdated ones, and to surface the outdated status visually.
5. **Local resolution tracking for ghui-sourced comments** — Comments created from ghui should be tracked in SQLite with an explicit resolved/unresolved state that the user must manually set.

**Diff viewing remains out of scope.**

---

## Current Code Context

### Electron app structure
- `packages/electron/src/renderer/App.tsx` — top-level shell (51 lines); PR list + detail + comments pane + command palette
- `packages/electron/src/renderer/components/CommentsPane.tsx` — fetches unified comments via `pr:comments` IPC; `buildThreads` function (L16–35) for threading
- `packages/electron/src/renderer/components/CommentThread.tsx` — renders single thread; reply always calls `onReply(body)` → `createIssueComment` (bug)
- `packages/electron/src/renderer/components/PRDetail.tsx` — shows PR metadata; body rendered as raw text (no markdown); no submit review UI; label badges shown but no add/remove UI
- `packages/electron/src/renderer/components/PRList.tsx` — tabs for queue modes, but `"inbox"` explicitly filtered out (L53); no "Load more" button
- `packages/electron/src/renderer/components/MergeControls.tsx` — merge/close/draft toggle; functional
- `packages/electron/src/renderer/hooks/useCoreBridge.ts` — typed IPC wrappers; missing `replyToReviewComment`, `editIssueComment`, `deleteIssueComment`, comment-tracking channels
- `packages/electron/src/shared/ipcProtocol.ts` — channel types; same omissions as above
- `packages/electron/src/main/ipc.ts` — IPC handlers; same omissions

### Core domain/service relevant to this plan
- `packages/core/src/domain.ts` L110–120 — `PullRequestReviewComment` interface; **no `outdated` field**
- `packages/core/src/services/GitHubService.ts` L164–183 — REST schema for review comments; **does not fetch `outdated`**
- `packages/core/src/services/GitHubService.ts` L873–885 — `listPullRequestComments` fetches both issue comments and review comments in parallel; already returns both types merged and sorted
- `packages/core/src/services/GitHubService.ts` L961–985 — `replyToReviewComment` exists but is **not exposed via IPC** in the Electron app
- `packages/core/src/services/CacheService.ts` — SQLite-backed service; has `review_findings` for ACP but **no table for comment resolution tracking**
- `src/ui/CommentsPane.tsx` L60–133 — `orderCommentsForDisplay` with DFS threading and quote-reply heuristic — the reference implementation

### Terminal features absent from Electron (non-diff)
| Terminal Feature | Gap |
|---|---|
| Submit review (approve / comment / request changes) | IPC channel `pr:review` exists; no renderer UI |
| Label add / remove | IPC channels exist; no UI beyond display badges |
| Inbox queue mode | `pullRequestQueueModes` includes "inbox"; PRList.tsx filters it out |
| Rendered markdown body | PRDetail shows `{pr.body}` as raw text |
| Load more (pagination) | No "Load more" button; Electron always loads a single page |

---

## Proposed Changes

### Work Area 1 — Core domain: `outdated` field on review comments

**File: `packages/core/src/domain.ts`**

Add `outdated` to `PullRequestReviewComment`:

```ts
export interface PullRequestReviewComment {
  // ... existing fields ...
  readonly outdated: boolean  // NEW: true when the code line no longer exists at HEAD
}
```

**File: `packages/core/src/services/GitHubService.ts`**

Add `outdated: Schema.optionalKey(Schema.Boolean)` to the REST schema (around L164–183). The field is present in GitHub's REST response for review comments but may be absent in older payloads or mocked responses. The parser must default missing values to `false`.

```ts
// In parsePullRequestComments:
outdated: raw.outdated ?? false
```

**Impact:** The `MockGitHubService` needs `outdated: false` in its stub review comments. The `disabledLayer` stubs in `CacheService` (L749–772) need to be updated for the new methods added in Work Area 2 (see below).

---

### Work Area 2 — Core domain: comment tracking table

A new SQLite table and `CacheService` methods to track which comments were opened from ghui and their resolution state.

**Migration: `003_comment_tracking`** (add to `cacheMigrations` in `CacheService.ts`):

```sql
CREATE TABLE IF NOT EXISTS ghui_comment_tracking (
  comment_id   TEXT NOT NULL PRIMARY KEY,
  pr_key       TEXT NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0,
  resolved_at  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ghui_comment_tracking_pr_key
  ON ghui_comment_tracking (pr_key);
```

**New `CacheService` methods** (following the `Effect.fn` pattern for mutations and direct `Effect.Effect<T, CacheError>` for queries):

```ts
trackComment(commentId: string, prKey: string): Effect<void, never>
resolveComment(commentId: string): Effect<void, never>
listTrackedComments(prKey: string): Effect<readonly TrackedComment[], CacheError>
```

`trackComment` and `resolveComment` use `Effect.fn("CacheService.xxx")` and swallow errors (consistent with `upsertWorktree`, `deleteWorktree`, etc.). `listTrackedComments` returns `CacheError` on decode failure, consistent with `listFindings`.

`TrackedComment` is a new domain type added to `packages/core/src/domain.ts`:

```ts
export interface TrackedComment {
  readonly commentId: string
  readonly prKey: string
  readonly resolved: boolean
  readonly resolvedAt: Date | null
  readonly createdAt: Date
}
```

The table only contains rows for comments created from ghui. Resolution state is entirely local — it does not call GitHub's `resolveReviewThread` GraphQL mutation. This is a deliberate simplification: resolution is a local "I've seen and actioned this" marker.

**Deliberate one-way state:** There is no `unresolveComment` method. Resolution is intended to be a permanent "I have actioned this" mark. If this turns out to be wrong, it is a one-line schema + method addition later.

**`CacheService` class type update:** The `CacheService` `Context.Service` type parameter (L725–748) must include all three new methods. The `CacheService.disabledLayer` (L749–772) must be extended with no-op stubs for `trackComment`, `resolveComment`, and `listTrackedComments`.

**Pruning:** Add tracked comment cleanup to `pruneSql` using the same 30-day cutoff:

```sql
DELETE FROM ghui_comment_tracking
WHERE pr_key NOT IN (
  SELECT value FROM queue_snapshots, json_each(queue_snapshots.pr_keys_json)
) AND created_at < ${cutoff}
```

This keeps tracking rows for any PR still in an active queue snapshot and removes stale rows for closed/abandoned PRs.

---

### Work Area 3 — IPC protocol additions

**File: `packages/electron/src/shared/ipcProtocol.ts`**

Add channels:

```ts
"pr:reviewComment:reply":    { args: [repo: string, number: number, inReplyTo: string, body: string]; result: PullRequestComment }
"pr:issueComment:edit":      { args: [repo: string, commentId: string, body: string]; result: void }
"pr:issueComment:delete":    { args: [repo: string, commentId: string]; result: void }
"comment:track":             { args: [commentId: string, prKey: string]; result: void }
"comment:resolve":           { args: [commentId: string]; result: void }
"comment:listTracked":       { args: [prKey: string]; result: readonly TrackedComment[] }
```

Existing channels that are **already present** but need handlers noted:
- `pr:comment:edit` currently calls `github.editReviewComment` — correct for review comments only
- `pr:comment:delete` currently calls `github.deleteReviewComment` — correct for review comments only
- The NEW `pr:issueComment:edit` and `pr:issueComment:delete` are for issue comments

**File: `packages/electron/src/main/ipc.ts`**

Wire the new handlers:

```ts
handle("pr:reviewComment:reply", (repo, number, inReplyTo, body) =>
  GitHubService.use(g => g.replyToReviewComment(repo, number, inReplyTo, body)))

handle("pr:issueComment:edit", (repo, commentId, body) =>
  GitHubService.use(g => g.editPullRequestIssueComment(repo, commentId, body)))

handle("pr:issueComment:delete", (repo, commentId) =>
  GitHubService.use(g => g.deletePullRequestIssueComment(repo, commentId)))

handle("comment:track", (commentId, prKey) =>
  CacheService.use(c => c.trackComment(commentId, prKey)))

handle("comment:resolve", (commentId) =>
  CacheService.use(c => c.resolveComment(commentId)))

handle("comment:listTracked", (prKey) =>
  CacheService.use(c => c.listTrackedComments(prKey)))
```

**File: `packages/electron/src/renderer/hooks/useCoreBridge.ts`**

Expose the new channels as typed `coreBridge` methods.

---

### Work Area 4 — Comment threading rewrite

**Prerequisite: extract threading helpers to a shared module**

The terminal's `orderCommentsForDisplay` (L95–133) depends on three helpers defined in `src/ui/CommentsPane.tsx`:
- `collapseWhitespace` (L52–58)
- `issueQuoteParent` (L60–84)
- `QUOTE_HEADER_RE` — re-exported from `src/ui/comments.tsx` L154

And `stripQuoteHeader` from `src/ui/comments.tsx` L158–162.

These helpers already live in `src/ui/comments.tsx` (for `QUOTE_HEADER_RE` and `stripQuoteHeader`) or in `src/ui/CommentsPane.tsx` (for `collapseWhitespace` and `issueQuoteParent`). Since the Electron renderer is a web app with no access to terminal-specific files, the threading algorithm and its deps must be extracted to **`@ghui/core`** (e.g. `packages/core/src/commentThreading.ts`). This file should export:

- `QUOTE_HEADER_RE`
- `collapseWhitespace`
- `issueQuoteParent`
- `stripQuoteHeader`
- `orderCommentsForDisplay`
- `OrderedComment` type
- `MAX_INDENT_LEVELS` constant

The terminal's `CommentsPane.tsx` and `comments.tsx` are then updated to import from `@ghui/core` instead of defining locally.

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

Replace `buildThreads` with the imported `orderCommentsForDisplay` from `@ghui/core`.

The existing `Thread = { id, comments[] }` flat structure is removed. The renderer moves to a flat `OrderedComment[]` where `indent > 0` indicates a reply.

This extraction keeps the implementation in one place and means the terminal and Electron share the exact same threading algorithm without duplication.

**Thread grouping for display:** The Electron UI renders threads as visual groups rather than the TUI's scrollable block list. Each root comment (indent === 0) starts a new `<div className="comment-thread">`, and its replies are nested underneath. Review comment threads additionally show a file context header (`path:line`).

---

### Work Area 5 — Comment routing fixes

**Prerequisite: extract `findReviewThreadRootId`**

`findReviewThreadRootId` exists in `src/App.tsx` L656–668 and walks the `inReplyTo` chain to find the thread root (GitHub's reply endpoint requires the root id, not a reply id). It must be extracted to `@ghui/core` (`packages/core/src/commentThreading.ts`, alongside `orderCommentsForDisplay`). The terminal's App.tsx is then updated to import it from `@ghui/core`.

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

Fix reply mutation. `CommentsPane` has access to the full comment list and can compute the thread root id before firing the IPC. The `isReviewThread` flag is determined by checking whether the thread's root comment has `_tag === "review-comment"`:

```ts
const replyToThread = useMutation({
  mutationFn: ({ threadRootComment, body }: { threadRootComment: PullRequestComment; body: string }) => {
    if (threadRootComment._tag === "review-comment") {
      const rootId = findReviewThreadRootId(comments ?? [], threadRootComment.id)
      return coreBridge.replyToReviewComment(repo, number, rootId, body)
    }
    return coreBridge.createIssueComment(repo, number, body)
  },
  onSuccess: (result) => {
    invalidate()
    void coreBridge.trackComment(result.id, `${repo}#${number}`)
  }
})
```

`CommentsPane` passes `threadRootComment` (the first comment in the thread, already known at render time) to `CommentThread`, which forwards it in the `onReply` callback.

**File: `packages/electron/src/renderer/components/CommentThread.tsx`**

- `onReply` callback signature changes from `(body: string) => void` to `(body: string, threadRoot: PullRequestComment) => void`. `CommentThread` knows its root (first element of `comments` prop).
- `onEdit` callback adds `commentTag: PullRequestComment["_tag"]` so `CommentsPane` routes to the correct IPC endpoint.
- `onDelete` callback similarly adds `commentTag`.

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

After the change, edit/delete mutations dispatch by tag:

```ts
const editComment = useMutation({
  mutationFn: ({ id, tag, body }: { id: string; tag: PullRequestComment["_tag"]; body: string }) =>
    tag === "review-comment"
      ? coreBridge.editComment(repo, id, body)           // pr:comment:edit → editReviewComment
      : coreBridge.editIssueComment(repo, id, body),     // pr:issueComment:edit → editPullRequestIssueComment
  onSuccess: invalidate,
})

const deleteComment = useMutation({
  mutationFn: ({ id, tag }: { id: string; tag: PullRequestComment["_tag"] }) =>
    tag === "review-comment"
      ? coreBridge.deleteComment(repo, id)               // pr:comment:delete → deleteReviewComment
      : coreBridge.deleteIssueComment(repo, id),         // pr:issueComment:delete → deletePullRequestIssueComment
  onSuccess: invalidate,
})
```

---

### Work Area 6 — Outdated thread display

**File: `packages/electron/src/renderer/components/CommentThread.tsx`**

In the thread header, when `comments[0]._tag === "review-comment" && comments[0].outdated`, render an "outdated" badge:

```tsx
{rootComment._tag === "review-comment" && rootComment.outdated && (
  <span className="comment-thread-outdated-badge">outdated</span>
)}
```

The thread is always displayed regardless of `outdated` status. There is no filtering.

---

### Work Area 7 — Local resolution state UI

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

After fetching comments, also fetch tracked comments:

```ts
const { data: trackedComments } = useQuery({
  queryKey: ["comment:tracked", `${repo}#${number}`],
  queryFn: () => coreBridge.listTrackedComments(`${repo}#${number}`)
})

const trackedByCommentId = useMemo(
  () => new Map((trackedComments ?? []).map(t => [t.commentId, t])),
  [trackedComments]
)
```

Pass `trackedByCommentId` and a `onResolve` handler to `CommentThread`.

**File: `packages/electron/src/renderer/components/CommentThread.tsx`**

For each comment in the thread, check if it's ghui-sourced and unresolved:

```tsx
const tracked = trackedByCommentId?.get(comment.id)
const isGhuiOwned = !!tracked
const isUnresolved = isGhuiOwned && !tracked.resolved

// In the comment header area:
{isUnresolved && (
  <span className="comment-unresolved-badge">● Unresolved</span>
)}
{isGhuiOwned && tracked.resolved && (
  <span className="comment-resolved-badge">✓ Resolved</span>
)}

// Action row (own comments only):
{isGhuiOwned && !tracked.resolved && (
  <button className="btn-sm btn-ghost" onClick={() => onResolve(comment.id)}>
    Resolve
  </button>
)}
```

The "Resolve" button is shown only for ghui-sourced unresolved comments regardless of `isOwn` — the current user is always the author of their own ghui-sourced comments, but making it explicit avoids a dependency on `currentUser` for the resolve action.

---

### Work Area 8 — Feature parity: Submit Review

**File: `packages/electron/src/renderer/components/PRDetail.tsx`**

Add a `SubmitReview` section below merge controls:

```tsx
<SubmitReview repo={repo} number={number} />
```

**New file: `packages/electron/src/renderer/components/SubmitReview.tsx`**

```tsx
export const SubmitReview = ({ repo, number }: { repo: string; number: number }) => {
  const [event, setEvent] = useState<PullRequestReviewEvent>("COMMENT")
  const [body, setBody] = useState("")
  const queryClient = useQueryClient()

  const submit = useMutation({
    mutationFn: () => coreBridge.submitReview({ repository: repo, number, event, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pr:details", repo, number] })
      setBody("")
    },
  })

  return (
    <div className="submit-review">
      <div className="pr-detail-section-title">Submit review</div>
      <div className="review-event-options">
        {(["APPROVE", "COMMENT", "REQUEST_CHANGES"] as const).map(e => (
          <label key={e}>
            <input type="radio" name="review-event" value={e}
              checked={event === e} onChange={() => setEvent(e)} />
            {e === "APPROVE" ? "Approve" : e === "COMMENT" ? "Comment" : "Request changes"}
          </label>
        ))}
      </div>
      <textarea
        className="comment-textarea"
        placeholder="Leave a comment (optional for Approve)"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <button className="btn btn-primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "Submitting…" : "Submit review"}
      </button>
    </div>
  )
}
```

---

### Work Area 9 — Feature parity: Label management

**File: `packages/electron/src/renderer/components/PRDetail.tsx`**

Extend the labels section to include add/remove controls. Fetch repo labels lazily on demand (a "manage labels" expand button pattern keeps the default render simple).

**New file: `packages/electron/src/renderer/components/LabelManager.tsx`**

- Fetches `coreBridge.listLabels(repo)` on expansion
- Filters the list with a search input
- Checked labels = current PR labels; unchecked = available to add
- Toggle fires `coreBridge.addLabel` or `coreBridge.removeLabel` and invalidates `["pr:details", repo, number]`

---

### Work Area 10 — Feature parity: Inbox tab

**File: `packages/electron/src/renderer/components/PRList.tsx`**

Remove the `.filter((m) => m !== "inbox")` exclusion (L53). The inbox mode is already supported by the core and IPC layers. Ensure the tab label uses `pullRequestQueueLabels` from core.

---

### Work Area 11 — Feature parity: Markdown body rendering

**File: `packages/electron/src/renderer/components/PRDetail.tsx`**

Replace `<div className="pr-detail-body">{pr.body}</div>` with a markdown renderer. Use `react-markdown` (already a common dep in the web ecosystem; confirm it's not already in `packages/electron/package.json` before adding).

```tsx
import ReactMarkdown from "react-markdown"
// ...
{pr.body && (
  <div className="pr-detail-body">
    <ReactMarkdown>{pr.body}</ReactMarkdown>
  </div>
)}
```

Syntax highlighting for fenced code blocks can be added with `rehype-highlight` as a follow-up; for MVP raw markdown rendering without highlighting is acceptable.

---

### Work Area 12 — Feature parity: Load more pagination

**File: `packages/electron/src/renderer/components/PRList.tsx`**

The `coreBridge.listPullRequests` returns a `PullRequestPage` which includes `hasNextPage` and `endCursor`. Expose a "Load more" button:

```tsx
const [cursor, setCursor] = useState<string | null>(null)
const [allItems, setAllItems] = useState<PullRequestItem[]>([])

// On successful load, accumulate pages:
// setAllItems(prev => [...prev, ...data.items])

// Reset on view change (useEffect):
// setCursor(null); setAllItems([])

{data?.hasNextPage && (
  <button onClick={() => setCursor(data.endCursor)}>Load more</button>
)}
```

---

## Implementation Order

1. Add `outdated: boolean` to `PullRequestReviewComment` domain type + schema (`Schema.optionalKey`, `?? false` fallback in parser)
2. Add `TrackedComment` domain type to `packages/core/src/domain.ts`
3. **Extract threading module to `@ghui/core`** — `packages/core/src/commentThreading.ts` exporting `QUOTE_HEADER_RE`, `collapseWhitespace`, `issueQuoteParent`, `stripQuoteHeader`, `orderCommentsForDisplay`, `findReviewThreadRootId`, `OrderedComment`, `MAX_INDENT_LEVELS`
4. Update `src/ui/CommentsPane.tsx` and `src/ui/comments.tsx` to import from `@ghui/core` instead of local definitions
5. Add `003_comment_tracking` migration + `trackComment`/`resolveComment`/`listTrackedComments` to `CacheService`, including `CacheService` class type update, `disabledLayer` no-ops, and `pruneSql` cleanup
6. Add new IPC channels to `ipcProtocol.ts` + wire handlers in `ipc.ts`
7. Expose new channels in `useCoreBridge.ts`
8. Port `orderCommentsForDisplay` into Electron `CommentsPane.tsx` (import from `@ghui/core`); replace `buildThreads`
9. Fix reply routing in `CommentsPane.tsx` (review vs issue dispatch, using `findReviewThreadRootId` from `@ghui/core`)
10. Fix edit/delete routing in `CommentsPane.tsx` (review vs issue dispatch by `_tag`)
11. Add outdated badge in `CommentThread.tsx`
12. Add resolution state UI (unresolved indicator + Resolve button) in `CommentThread.tsx`
13. Wire `comment:track` call on successful comment creation (in `onSuccess` of reply/create mutations)
14. Inbox tab: remove filter in `PRList.tsx`
15. Markdown body rendering in `PRDetail.tsx`
16. `SubmitReview` component
17. `LabelManager` component
18. Load more pagination in `PRList.tsx`

---

## Verification Plan

1. **TypeScript compilation** — `bun run typecheck` must pass across all packages after domain type additions. The `CacheService` `disabledLayer` and `Context.Service` type parameter updates are required or the build fails.
2. **Existing tests** — `bun run test` must continue to pass. No regressions to core or TUI.
3. **Mock service update** — `MockGitHubService` needs `outdated: false` on stubbed `PullRequestReviewComment` objects; verify mock passes its tests.
4. **Comment threading unit tests** — Extract `orderCommentsForDisplay` and its helpers to `@ghui/core`. The terminal has tests exercising this logic (confirm in `test/`). Add equivalent tests in the Electron package or in core for the extracted module: cover mixed issue+review comments, quote-reply threading, deep nesting capped at 3, DFS ordering, cycles.
5. **Reply routing test** — Unit test that verifies: replying to a review comment thread calls `replyToReviewComment` with the *root* comment id (not a reply id); replying to an issue comment calls `createIssueComment`.
6. **Edit/delete routing test** — Unit test that verifies: editing/deleting a `_tag === "review-comment"` calls the review endpoint; editing/deleting a `_tag === "comment"` calls the issue-comment endpoint.
7. **IPC contract test** — Extend existing Electron IPC contract tests to cover `pr:reviewComment:reply`, `pr:issueComment:edit`, `pr:issueComment:delete`, `comment:track`, `comment:resolve`, `comment:listTracked`.
8. **Resolution state roundtrip** — Test that: (a) creating a comment inserts a row in `ghui_comment_tracking`, (b) `listTrackedComments` returns it with `resolved: false`, (c) calling `resolveComment` flips the flag and sets `resolved_at`.
9. **Manual smoke** — Launch Electron app. Verify: inbox tab appears, PR body renders as markdown, label manager opens, submit review fires successfully, comments thread correctly with indent, outdated badge appears on an outdated thread, creating a comment shows the unresolved indicator, Resolve button marks it resolved.

---

## Risks / Open Questions

1. **`react-markdown` dependency** — Adding `react-markdown` (and optionally `rehype-highlight`) adds ~100 KB to the renderer bundle. Check existing `package.json` for any prior markdown dep before adding.
2. **`outdated` field on `PullRequestReviewComment`** — The field is in the GitHub REST response. Using `Schema.optionalKey(Schema.Boolean)` with a `?? false` fallback in the parser handles older/cached responses safely. Confirmed the field name is `"outdated"` in the GitHub REST API.
3. **Review comment reply requires root ID** — `replyToReviewComment` calls `POST .../comments/{id}/replies`. GitHub requires `{id}` to be a *root* comment id, not a reply's id. `findReviewThreadRootId` (extracted to `@ghui/core`) handles this. See Work Area 5 for the exact callsite.
4. **Local resolution vs GitHub resolution** — We are NOT calling GitHub's `resolveReviewThread` GraphQL mutation. GitHub and ghui's resolution state will diverge. This is intentional. UI copy should say "Resolve in ghui" to make the local scope clear.
5. **Renderer-side edit/delete dispatch** — The plan dispatches on `comment._tag` in the renderer, calling different IPC channels per type. This is clean but requires the `_tag` to be threaded through the `CommentThread` callbacks. The alternative (main-side dispatch with a `commentType` arg on a single channel) would centralise the routing but adds a `commentType` field to the IPC envelope. Decision: renderer-side is cleaner given React's component model.
6. **`TrackedComment` scope** — The type lives in `@ghui/core` alongside `ReviewFinding`. Only the Electron app currently consumes it via IPC, but keeping it in core is consistent with the project pattern and leaves it available if the terminal TUI ever needs it.
7. **No `unresolveComment` method** — Resolution is one-way by design ("I have actioned this"). If this turns out to be too restrictive, adding `unresolveComment` is a minimal change later.
8. **Threading helpers extraction scope** — Extracting `orderCommentsForDisplay`, `findReviewThreadRootId`, and helpers to `@ghui/core` is a semantic change to the core package. It does not change any `GitHubService` or `CacheService` interfaces. The terminal's `src/ui/CommentsPane.tsx` and `src/ui/comments.tsx` become consumers of the extracted module. Test coverage for the extracted logic belongs in `packages/core/test/`.

## Open Questions

1. **Should the PR list item show a badge for unresolved ghui-sourced comments?** E.g. `2 unresolved` next to the comment count. This would require fetching `listTrackedComments` for every visible PR, which is expensive. The safer option is to show the badge only for the currently selected PR. — **Need human sign-off.**
2. **`react-markdown`** — Any objection to adding it? — **Need human sign-off.**
3. **Submit review placement** — placed below merge controls in `PRDetail`. Should it be in the `CommentsPane` instead? — **Need human sign-off.**

---

## Status

Reviewed — awaiting human sign-off.
