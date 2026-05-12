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

Add `outdated: Schema.Boolean` to the REST schema (around L164–183) so the field is fetched and propagated through `parsePullRequestComments`. The GitHub REST endpoint returns `outdated: true` on review comments that target code no longer at the PR head.

**Impact:** The `MockGitHubService` needs `outdated: false` in its stub review comments.

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

**New `CacheService` methods:**

```ts
trackComment(commentId: string, prKey: string): Effect<void>
resolveComment(commentId: string): Effect<void>
listTrackedComments(prKey: string): Effect<readonly TrackedComment[]>
```

Where `TrackedComment` is a new domain type:

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

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

Replace `buildThreads` with a port of the terminal's `orderCommentsForDisplay` algorithm from `src/ui/CommentsPane.tsx` L95–133.

The ported function produces `Array<{ comment: PullRequestComment; indent: number }>` (identical to `OrderedComment[]` from the terminal). This naturally handles:
- `inReplyTo` chains for review comments (DFS tree)
- `issueQuoteParent` heuristic for issue comments replying via the `> @author wrote:` pattern
- Indent depth capped at `MAX_INDENT_LEVELS = 3`
- Cycle detection via `visited` set

The existing `Thread = { id, comments[] }` flat structure is removed. The renderer moves to a flat `OrderedComment[]` where `indent > 0` indicates a reply.

This is a pure copy-port, not a reimplementation — the algorithm in the terminal is correct and tested.

**Thread grouping for display:** The Electron UI renders threads as visual groups rather than the TUI's scrollable block list. Each root comment (indent === 0) starts a new `<div className="comment-thread">`, and its replies are nested underneath. Review comment threads additionally show a file context header (`path:line`).

---

### Work Area 5 — Comment routing fixes

**File: `packages/electron/src/renderer/components/CommentsPane.tsx`**

Fix reply mutation:

```ts
// OLD (wrong for review comment threads):
const createComment = useMutation({
  mutationFn: (body: string) => coreBridge.createIssueComment(repo, number, body),
})

// NEW: pass the thread root's id and comment type through:
const replyToThread = useMutation({
  mutationFn: ({ threadRootId, isReviewThread, body }: ReplyInput) =>
    isReviewThread
      ? coreBridge.replyToReviewComment(repo, number, threadRootId, body)
      : coreBridge.createIssueComment(repo, number, body),
  onSuccess: () => {
    invalidate()
    // track the new comment if it's from ghui
    // (done in the mutation success handler once we have the comment id)
  }
})
```

**File: `packages/electron/src/renderer/components/CommentThread.tsx`**

- `onEdit` callback now carries `_tag` so `CommentsPane` routes to the correct IPC endpoint.
- `onDelete` callback similarly carries `_tag`.
- After a successful `createIssueComment` or `replyToReviewComment`, call `coreBridge.trackComment(commentId, prKey)` to register the new comment as ghui-sourced.

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

## Verification Plan

1. **TypeScript compilation** — `bun run typecheck` must pass across all packages after domain type additions.
2. **Existing tests** — `bun run test` must continue to pass. No regressions to core or TUI.
3. **Mock service update** — `MockGitHubService` needs `outdated: false` on stubbed `PullRequestReviewComment` objects; verify mock passes its tests.
4. **Comment threading unit tests** — The ported `orderCommentsForDisplay` logic already has test coverage in the terminal (`test/`). A small integration test in the Electron package should verify the ported version handles the edge cases: mixed issue+review comments, quote-reply threading, deep nesting capped at 3, cycles.
5. **IPC contract test** — Extend existing Electron IPC contract tests to cover `pr:reviewComment:reply`, `pr:issueComment:edit`, `pr:issueComment:delete`, `comment:track`, `comment:resolve`, `comment:listTracked`.
6. **Resolution state roundtrip** — Test that: (a) creating a comment inserts a row in `ghui_comment_tracking`, (b) `listTrackedComments` returns it with `resolved: false`, (c) calling `resolveComment` flips the flag and sets `resolved_at`.
7. **Manual smoke** — Launch Electron app. Verify: inbox tab appears, PR body renders as markdown, label manager opens, submit review fires successfully, comments thread correctly with indent, outdated badge appears on an outdated thread, creating a comment shows the unresolved indicator, Resolve button marks it resolved.

---

## Risks / Open Questions

1. **`react-markdown` dependency** — Adding `react-markdown` (and optionally `rehype-highlight`) adds ~100 KB to the renderer bundle. Check existing `package.json` for any prior markdown dep before adding.
2. **`outdated` field on `PullRequestReviewComment`** — The field is in the GitHub REST response. Adding it to the schema is low risk, but `original_line` (already fetched but unused) suggests we've already seen partial unused fields. Confirm the field name is literally `"outdated"` in the raw GitHub JSON (it is — documented in GitHub REST API docs).
3. **Review comment reply targets the root ID** — `replyToReviewComment` calls `POST .../comments/{id}/replies`. GitHub requires `{id}` to be a *root* comment id, not a reply's id. The terminal handles this via `findReviewThreadRootId` (`src/App.tsx` L656–668). The Electron port must do the same. The fix is straightforward: walk the `inReplyTo` chain to find the root before calling the IPC.
4. **Local resolution vs GitHub resolution** — We are NOT calling GitHub's `resolveReviewThread` GraphQL mutation. This means GitHub and ghui's resolution state will diverge. A user resolving a thread on GitHub will not see it reflected in ghui's local tracking, and vice versa. This is intentional (user requested explicit local tracking), but should be clearly communicated via UI copy ("Resolve in ghui" rather than just "Resolve").
5. **IPC channel naming** — `pr:comment:edit` currently routes to `editReviewComment`. Adding `pr:issueComment:edit` alongside creates two "edit comment" channels differentiated by comment type. This is correct but callers must dispatch on `_tag`. An alternative is a single `pr:comment:edit` that dispatches by comment type on the main process side. This is cleaner — see Open Question below.
6. **Should edit/delete dispatch by type in main or renderer?** Two options:
   - **Main-side dispatch**: single `pr:comment:edit` IPC channel; main process inspects a `commentType` arg and routes to the correct service method. Requires serialising `_tag` across the wire.
   - **Renderer-side dispatch**: renderer calls different channels based on `comment._tag`. Clean types but two channels to maintain.
   - Recommendation: renderer-side dispatch. Type discrimination happens naturally in React components; avoids adding `commentType` to the IPC envelope.
7. **`TrackedComment` domain type location** — Should it live in `@ghui/core` (alongside `ReviewFinding`) or only in the Electron IPC protocol? Given the CacheService is in core, the domain type should also live in core even though only the Electron app consumes it currently.

---

## Relevant Files / Research References

- `_findings/codebase-research-github-comments-api.md` — API surface research
- `packages/core/src/domain.ts` L110–120 — `PullRequestReviewComment`
- `packages/core/src/services/GitHubService.ts` L164–183, L868–985 — comment API methods
- `packages/core/src/services/CacheService.ts` L267–361 — migration pattern and service methods
- `packages/electron/src/renderer/components/CommentsPane.tsx` — current Electron thread building
- `packages/electron/src/renderer/components/CommentThread.tsx` — current render + reply
- `packages/electron/src/shared/ipcProtocol.ts` — current IPC channels
- `packages/electron/src/main/ipc.ts` — current IPC handlers
- `src/ui/CommentsPane.tsx` L60–133 — `orderCommentsForDisplay` reference impl
- `src/App.tsx` L656–668 — `findReviewThreadRootId` (needed for reply routing)

---

## Implementation Order

1. Add `outdated: boolean` to `PullRequestReviewComment` domain type + schema
2. Add `TrackedComment` domain type to `packages/core/src/domain.ts`
3. Add `003_comment_tracking` migration + `trackComment`/`resolveComment`/`listTrackedComments` to `CacheService`
4. Add new IPC channels to `ipcProtocol.ts` + wire handlers in `ipc.ts`
5. Expose new channels in `useCoreBridge.ts`
6. Port `orderCommentsForDisplay` into Electron `CommentsPane.tsx`; replace `buildThreads`
7. Fix reply routing in `CommentsPane.tsx` (review vs issue dispatch)
8. Fix edit/delete routing in `CommentsPane.tsx` (review vs issue dispatch)
9. Add outdated badge in `CommentThread.tsx`
10. Add resolution state UI (unresolved indicator + Resolve button) in `CommentThread.tsx`
11. Wire `comment:track` call on successful comment creation
12. Inbox tab: remove filter in `PRList.tsx`
13. Markdown body rendering in `PRDetail.tsx`
14. `SubmitReview` component
15. `LabelManager` component
16. Load more pagination in `PRList.tsx`

---

## Open Questions

1. *(Resolved above)* Renderer-side vs main-side dispatch for edit/delete by comment type → **renderer-side dispatch**.
2. **What triggers the "unresolved" indicator badge count?** Should the PR list item show a badge like "2 unresolved" for PRs that have ghui-created unresolved comments? Or is resolution state only visible inside the comments pane? — **Need human sign-off.**
3. **Markdown rendering library** — `react-markdown` is the canonical choice. Any objection to adding it? — **Need human sign-off.**
4. **Submit review placement** — placed below merge controls in `PRDetail`. Should it be in the `CommentsPane` instead (since it's a comment action)? — **Need human sign-off.**

---

## Status

DRAFT — awaiting reviewer pass and human sign-off.
