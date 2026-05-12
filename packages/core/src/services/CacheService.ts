import { Context, Effect, Layer, Schema } from "effect"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { checkConclusions, checkRollupStatuses, checkRunStatuses, pullRequestQueueModes, pullRequestStates, reviewStatuses, type PullRequestItem } from "../domain.js"
import { mergeCachedDetails } from "../pullRequestCache.js"
import type { FindingStatus, ReviewFinding, ReviewReport, ReviewSession, ReviewWorktree, SessionMessage } from "../domain.js"
import type { PullRequestLoad } from "../pullRequestLoad.js"
import { type PullRequestView, viewCacheKey } from "../pullRequestViews.js"

export interface PullRequestCacheKey {
	readonly repository: string
	readonly number: number
}

export class CacheError extends Schema.TaggedErrorClass<CacheError>()("CacheError", {
	operation: Schema.String,
	cause: Schema.Defect,
}) {}

const CheckConclusionSchema = Schema.Literals(checkConclusions)
const CheckRunStatusSchema = Schema.Literals(checkRunStatuses)
const CheckRollupStatusSchema = Schema.Literals(checkRollupStatuses)
const PullRequestStateSchema = Schema.Literals(pullRequestStates)
const ReviewStatusSchema = Schema.Literals(reviewStatuses)

const CachedPullRequestLabelSchema = Schema.Struct({
	name: Schema.String,
	color: Schema.NullOr(Schema.String),
})

const CachedCheckItemSchema = Schema.Struct({
	name: Schema.String,
	status: CheckRunStatusSchema,
	conclusion: Schema.NullOr(CheckConclusionSchema),
})

const CachedMergeableSchema = Schema.Literals(["mergeable", "conflicting", "unknown"] as const)
const CachedAssigneeSchema = Schema.Struct({ login: Schema.String })
const CachedReviewRequestSchema = Schema.Struct({
	type: Schema.Literals(["user", "team"] as const),
	name: Schema.String,
})

const CachedPullRequestItemSchema = Schema.Struct({
	repository: Schema.String,
	author: Schema.String,
	headRefOid: Schema.String,
	headRefName: Schema.optionalKey(Schema.String),
	number: Schema.Number,
	title: Schema.String,
	body: Schema.String,
	labels: Schema.Array(CachedPullRequestLabelSchema),
	additions: Schema.Number,
	deletions: Schema.Number,
	changedFiles: Schema.Number,
	state: PullRequestStateSchema,
	reviewStatus: ReviewStatusSchema,
	checkStatus: CheckRollupStatusSchema,
	checkSummary: Schema.NullOr(Schema.String),
	checks: Schema.Array(CachedCheckItemSchema),
	autoMergeEnabled: Schema.Boolean,
	detailLoaded: Schema.Boolean,
	createdAt: Schema.String,
	closedAt: Schema.NullOr(Schema.String),
	url: Schema.String,
	updatedAt: Schema.optionalKey(Schema.String),
	totalCommentsCount: Schema.optionalKey(Schema.Number),
	mergeable: Schema.optionalKey(Schema.NullOr(CachedMergeableSchema)),
	assignees: Schema.optionalKey(Schema.Array(CachedAssigneeSchema)),
	reviewRequests: Schema.optionalKey(Schema.Array(CachedReviewRequestSchema)),
})

const CachedPullRequestViewSchema = Schema.Union([
	Schema.Struct({ _tag: Schema.tag("Queue"), mode: Schema.Literals(pullRequestQueueModes), repository: Schema.NullOr(Schema.String) }),
	Schema.Struct({ _tag: Schema.tag("Repository"), repository: Schema.String }),
])

type CachedPullRequestItem = Schema.Schema.Type<typeof CachedPullRequestItemSchema>

interface PullRequestRow {
	readonly pr_key: string
	readonly data_json: string
}

interface QueueSnapshotRow {
	readonly view_json: string
	readonly pr_keys_json: string
	readonly fetched_at: string
	readonly end_cursor: string | null
	readonly has_next_page: number
}

interface ReviewWorktreeRow {
	readonly pr_key: string
	readonly worktree_path: string
	readonly branch_name: string
	readonly created_at: string
}

interface ReviewSessionRow {
	readonly session_id: string
	readonly pr_key: string
	readonly worktree_path: string
	readonly session_type: string
	readonly agent_name: string
	readonly started_at: string
	readonly ended_at: string | null
	readonly stop_reason: string | null
}

interface SessionMessageRow {
	readonly id: string
	readonly session_id: string
	readonly role: string
	readonly content: string
	readonly created_at: string
}

interface ReviewReportRow {
	readonly session_id: string
	readonly pr_key: string
	readonly verdict: string
	readonly report_md: string
	readonly canonical_path: string
	readonly submitted_at: string
}

interface ReviewFindingRow {
	readonly id: string
	readonly pr_key: string
	readonly session_id: string | null
	readonly head_ref_oid: string
	readonly source: string
	readonly file_path: string | null
	readonly line_start: number | null
	readonly line_end: number | null
	readonly diff_side: string | null
	readonly title: string | null
	readonly body: string
	readonly severity: string | null
	readonly status: string
	readonly modified_body: string | null
	readonly posted_url: string | null
	readonly created_at: string
	readonly updated_at: string
}

export const pullRequestCacheKey = ({ repository, number }: PullRequestCacheKey) => `${repository}#${number}`

const parseDate = (value: string) => {
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

const parseJson = (operation: string, json: string) =>
	Effect.try({
		try: () => JSON.parse(json) as unknown,
		catch: (cause) => new CacheError({ operation, cause }),
	})

const decodeCached = <S extends Schema.Top>(operation: string, schema: S, value: unknown) =>
	Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new CacheError({ operation, cause })))

const toCacheError = (operation: string, cause: unknown) => (cause instanceof CacheError ? cause : new CacheError({ operation, cause }))

const cachedPullRequestToDomain = (cached: CachedPullRequestItem): PullRequestItem | null => {
	const createdAt = parseDate(cached.createdAt)
	if (!createdAt) return null
	const closedAt = cached.closedAt === null ? null : parseDate(cached.closedAt)
	if (cached.closedAt !== null && !closedAt) return null
	const updatedAt = cached.updatedAt ? (parseDate(cached.updatedAt) ?? createdAt) : createdAt
	return {
		repository: cached.repository,
		author: cached.author,
		headRefOid: cached.headRefOid,
		headRefName: cached.headRefName ?? "",
		number: cached.number,
		title: cached.title,
		body: cached.body,
		labels: cached.labels,
		additions: cached.additions,
		deletions: cached.deletions,
		changedFiles: cached.changedFiles,
		state: cached.state,
		reviewStatus: cached.reviewStatus,
		checkStatus: cached.checkStatus,
		checkSummary: cached.checkSummary,
		checks: cached.checks,
		autoMergeEnabled: cached.autoMergeEnabled,
		detailLoaded: cached.detailLoaded,
		createdAt,
		updatedAt,
		closedAt,
		url: cached.url,
		totalCommentsCount: cached.totalCommentsCount ?? 0,
		mergeable: cached.mergeable ?? null,
		assignees: cached.assignees ? [...cached.assignees] : [],
		reviewRequests: cached.reviewRequests ? [...cached.reviewRequests] : [],
	}
}

const encodePullRequest = (pullRequest: PullRequestItem): CachedPullRequestItem => ({
	repository: pullRequest.repository,
	author: pullRequest.author,
	headRefOid: pullRequest.headRefOid,
	headRefName: pullRequest.headRefName,
	number: pullRequest.number,
	title: pullRequest.title,
	body: pullRequest.body,
	labels: pullRequest.labels,
	additions: pullRequest.additions,
	deletions: pullRequest.deletions,
	changedFiles: pullRequest.changedFiles,
	state: pullRequest.state,
	reviewStatus: pullRequest.reviewStatus,
	checkStatus: pullRequest.checkStatus,
	checkSummary: pullRequest.checkSummary,
	checks: pullRequest.checks,
	autoMergeEnabled: pullRequest.autoMergeEnabled,
	detailLoaded: pullRequest.detailLoaded,
	createdAt: pullRequest.createdAt.toISOString(),
	updatedAt: pullRequest.updatedAt.toISOString(),
	closedAt: pullRequest.closedAt?.toISOString() ?? null,
	url: pullRequest.url,
	totalCommentsCount: pullRequest.totalCommentsCount,
	mergeable: pullRequest.mergeable,
	assignees: [...pullRequest.assignees],
	reviewRequests: [...pullRequest.reviewRequests],
})

const decodePullRequestJson = (json: string): Effect.Effect<PullRequestItem, CacheError> =>
	Effect.gen(function* () {
		const value = yield* parseJson("decodePullRequest", json)
		const cached = yield* decodeCached("decodePullRequest", CachedPullRequestItemSchema, value)
		const pullRequest = cachedPullRequestToDomain(cached)
		if (!pullRequest) return yield* new CacheError({ operation: "decodePullRequest", cause: "invalid cached date" })
		return pullRequest
	})

const decodePullRequestViewJson = (json: string): Effect.Effect<PullRequestView, CacheError> =>
	Effect.gen(function* () {
		const value = yield* parseJson("decodePullRequestView", json)
		const view = yield* decodeCached("decodePullRequestView", CachedPullRequestViewSchema, value)
		return view
	})

const decodeStringArrayJson = (json: string): Effect.Effect<readonly string[], CacheError> =>
	Effect.gen(function* () {
		const value = yield* parseJson("decodeQueueKeys", json)
		return yield* decodeCached("decodeQueueKeys", Schema.Array(Schema.String), value)
	})

const dateFromCache = (operation: string, value: string) => {
	const date = parseDate(value)
	return date ? Effect.succeed(date) : Effect.fail(new CacheError({ operation, cause: `Invalid cached date: ${value}` }))
}

export const applyPragmas = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient
	yield* sql`PRAGMA synchronous = NORMAL`
	yield* sql`PRAGMA busy_timeout = 5000`
	yield* sql`PRAGMA foreign_keys = ON`
	yield* sql`PRAGMA temp_store = MEMORY`
	yield* sql`PRAGMA journal_size_limit = 16777216`
})

export const cacheMigrations = {
	"001_initial_cache_schema": Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient
		yield* sql`CREATE TABLE IF NOT EXISTS pull_requests (
			pr_key TEXT PRIMARY KEY,
			repository TEXT NOT NULL,
			number INTEGER NOT NULL,
			url TEXT NOT NULL,
			head_ref_oid TEXT NOT NULL,
			state TEXT NOT NULL,
			detail_loaded INTEGER NOT NULL,
			data_json TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`
		yield* sql`CREATE INDEX IF NOT EXISTS pull_requests_repository_number_idx ON pull_requests (repository, number)`
		yield* sql`CREATE TABLE IF NOT EXISTS queue_snapshots (
			viewer TEXT NOT NULL,
			view_key TEXT NOT NULL,
			view_json TEXT NOT NULL,
			pr_keys_json TEXT NOT NULL,
			fetched_at TEXT NOT NULL,
			end_cursor TEXT,
			has_next_page INTEGER NOT NULL,
			PRIMARY KEY (viewer, view_key)
		)`
	}),
	"002_acp_review": Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient
		yield* sql`CREATE TABLE IF NOT EXISTS review_worktrees (
			pr_key        TEXT NOT NULL PRIMARY KEY,
			worktree_path TEXT NOT NULL,
			branch_name   TEXT NOT NULL,
			created_at    TEXT NOT NULL
		)`
		yield* sql`CREATE TABLE IF NOT EXISTS review_sessions (
			session_id    TEXT NOT NULL PRIMARY KEY,
			pr_key        TEXT NOT NULL,
			worktree_path TEXT NOT NULL,
			session_type  TEXT NOT NULL CHECK (session_type IN ('review', 'chat')),
			agent_name    TEXT NOT NULL,
			started_at    TEXT NOT NULL,
			ended_at      TEXT,
			stop_reason   TEXT
		)`
		yield* sql`CREATE INDEX IF NOT EXISTS idx_review_sessions_pr_key
			ON review_sessions (pr_key)`
		yield* sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sessions_active_type
			ON review_sessions (session_type, worktree_path)
			WHERE ended_at IS NULL`
		yield* sql`CREATE TABLE IF NOT EXISTS session_messages (
			id          TEXT NOT NULL PRIMARY KEY,
			session_id  TEXT NOT NULL,
			role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
			content     TEXT NOT NULL,
			created_at  TEXT NOT NULL
		)`
		yield* sql`CREATE INDEX IF NOT EXISTS idx_session_messages_session_id
			ON session_messages (session_id)`
		yield* sql`CREATE TABLE IF NOT EXISTS review_reports (
			session_id      TEXT NOT NULL PRIMARY KEY,
			pr_key          TEXT NOT NULL,
			verdict         TEXT NOT NULL CHECK (verdict IN (
				'indeterminate_human_review_required',
				'good_for_merge',
				'block_merge',
				'minor_issues'
			)),
			report_md       TEXT NOT NULL,
			canonical_path  TEXT NOT NULL,
			submitted_at    TEXT NOT NULL
		)`
		yield* sql`CREATE TABLE IF NOT EXISTS review_findings (
			id            TEXT NOT NULL PRIMARY KEY,
			pr_key        TEXT NOT NULL,
			session_id    TEXT,
			head_ref_oid  TEXT NOT NULL,
			source        TEXT NOT NULL CHECK (source IN ('ai', 'human')),
			file_path     TEXT,
			line_start    INTEGER,
			line_end      INTEGER,
			diff_side     TEXT CHECK (diff_side IN ('LEFT', 'RIGHT')),
			title         TEXT,
			body          TEXT NOT NULL,
			severity      TEXT CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
			status        TEXT NOT NULL DEFAULT 'pending_review'
				CHECK (status IN ('pending_review', 'accepted', 'rejected', 'modified')),
			modified_body TEXT,
			posted_url    TEXT,
			created_at    TEXT NOT NULL,
			updated_at    TEXT NOT NULL
		)`
		yield* sql`CREATE INDEX IF NOT EXISTS idx_review_findings_pr_key
			ON review_findings (pr_key)`
	}),
} satisfies Record<string, Effect.Effect<void, unknown, SqlClient.SqlClient>>

const pullRequestRow = (pullRequest: PullRequestItem, updatedAt = new Date().toISOString()) => ({
	pr_key: pullRequestCacheKey(pullRequest),
	repository: pullRequest.repository,
	number: pullRequest.number,
	url: pullRequest.url,
	head_ref_oid: pullRequest.headRefOid,
	state: pullRequest.state,
	detail_loaded: pullRequest.detailLoaded ? 1 : 0,
	data_json: JSON.stringify(encodePullRequest(pullRequest)),
	updated_at: updatedAt,
})

const upsertPullRequestRowsSql = (sql: SqlClient.SqlClient, pullRequests: readonly PullRequestItem[]): Effect.Effect<void, SqlError> => {
	if (pullRequests.length === 0) return Effect.void
	const updatedAt = new Date().toISOString()
	const rows = pullRequests.map((pullRequest) => pullRequestRow(pullRequest, updatedAt))
	return sql`INSERT INTO pull_requests ${sql.insert(rows)}
		ON CONFLICT(pr_key) DO UPDATE SET
			repository = excluded.repository,
			number = excluded.number,
			url = excluded.url,
			head_ref_oid = excluded.head_ref_oid,
			state = excluded.state,
			detail_loaded = excluded.detail_loaded,
			data_json = excluded.data_json,
			updated_at = excluded.updated_at`.pipe(Effect.asVoid)
}

const upsertPullRequestSql = (sql: SqlClient.SqlClient, pullRequest: PullRequestItem) => upsertPullRequestRowsSql(sql, [pullRequest])

const readPullRequestSql = (sql: SqlClient.SqlClient, key: PullRequestCacheKey) =>
	Effect.gen(function* () {
		const rows = yield* sql<PullRequestRow>`SELECT pr_key, data_json FROM pull_requests WHERE pr_key = ${pullRequestCacheKey(key)} LIMIT 1`
		const row = rows[0]
		if (!row) return null
		return yield* decodePullRequestJson(row.data_json)
	})

const pruneSql = (sql: SqlClient.SqlClient) => {
	const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
	return Effect.gen(function* () {
		yield* sql`DELETE FROM queue_snapshots WHERE fetched_at < ${cutoff}`
		yield* sql`DELETE FROM pull_requests
			WHERE updated_at < ${cutoff}
			AND pr_key NOT IN (
				SELECT value FROM queue_snapshots, json_each(queue_snapshots.pr_keys_json)
			)`
	}).pipe(Effect.catch(() => Effect.void))
}

const liveCacheService = (sql: SqlClient.SqlClient) => {
	const readQueue = (viewer: string, view: PullRequestView): Effect.Effect<PullRequestLoad | null, CacheError> =>
		Effect.gen(function* () {
			const rows =
				yield* sql<QueueSnapshotRow>`SELECT view_json, pr_keys_json, fetched_at, end_cursor, has_next_page FROM queue_snapshots WHERE viewer = ${viewer} AND view_key = ${viewCacheKey(view)} LIMIT 1`
			const snapshot = rows[0]
			if (!snapshot) return null

			const [cachedView, prKeys, fetchedAt] = yield* Effect.all([
				decodePullRequestViewJson(snapshot.view_json),
				decodeStringArrayJson(snapshot.pr_keys_json),
				dateFromCache("decodeQueue", snapshot.fetched_at),
			])
			if (viewCacheKey(cachedView) !== viewCacheKey(view)) return null
			if (prKeys.length === 0) {
				return {
					view,
					data: [],
					fetchedAt,
					endCursor: snapshot.end_cursor,
					hasNextPage: snapshot.has_next_page === 1,
				} satisfies PullRequestLoad
			}

			const prRows = yield* sql<PullRequestRow>`SELECT pr_key, data_json FROM pull_requests WHERE pr_key IN ${sql.in(prKeys)}`
			const byKey = new Map<string, PullRequestItem>()
			for (const row of prRows) {
				const decoded = yield* decodePullRequestJson(row.data_json).pipe(Effect.catch(() => Effect.succeed(null)))
				if (decoded) byKey.set(row.pr_key, decoded)
			}
			const data = prKeys.flatMap((key: string) => {
				const pullRequest = byKey.get(key)
				return pullRequest ? [pullRequest] : []
			})

			return {
				view,
				data,
				fetchedAt,
				endCursor: snapshot.end_cursor,
				hasNextPage: snapshot.has_next_page === 1,
			} satisfies PullRequestLoad
		}).pipe(Effect.mapError((cause) => toCacheError("readQueue", cause)))

	const writeQueue = Effect.fn("CacheService.writeQueue")(function* (viewer: string, load: PullRequestLoad) {
		const fetchedAt = load.fetchedAt ?? new Date()
		const write = Effect.gen(function* () {
			if (load.data.length > 0) {
				const keys = load.data.map(pullRequestCacheKey)
				const existingRows = yield* sql<PullRequestRow>`SELECT pr_key, data_json FROM pull_requests WHERE pr_key IN ${sql.in(keys)}`
				const existing: PullRequestItem[] = []
				for (const row of existingRows) {
					const decoded = yield* decodePullRequestJson(row.data_json).pipe(Effect.catch(() => Effect.succeed(null)))
					if (decoded) existing.push(decoded)
				}
				yield* upsertPullRequestRowsSql(sql, mergeCachedDetails(load.data, existing))
			}
			const snapshot = {
				viewer,
				view_key: viewCacheKey(load.view),
				view_json: JSON.stringify(load.view),
				pr_keys_json: JSON.stringify(load.data.map(pullRequestCacheKey)),
				fetched_at: fetchedAt.toISOString(),
				end_cursor: load.endCursor,
				has_next_page: load.hasNextPage ? 1 : 0,
			}
			yield* sql`INSERT INTO queue_snapshots ${sql.insert(snapshot)}
				ON CONFLICT(viewer, view_key) DO UPDATE SET
					view_json = excluded.view_json,
					pr_keys_json = excluded.pr_keys_json,
					fetched_at = excluded.fetched_at,
					end_cursor = excluded.end_cursor,
					has_next_page = excluded.has_next_page`
		})
		const wrote = yield* sql.withTransaction(write).pipe(
			Effect.as(true),
			Effect.catch(() => Effect.succeed(false)),
		)
		if (wrote) yield* pruneSql(sql)
	})

	const readPullRequest = (key: PullRequestCacheKey): Effect.Effect<PullRequestItem | null, CacheError> =>
		readPullRequestSql(sql, key).pipe(Effect.mapError((cause) => toCacheError("readPullRequest", cause)))

	const upsertPullRequest = Effect.fn("CacheService.upsertPullRequest")(function* (pullRequest: PullRequestItem) {
		yield* upsertPullRequestSql(sql, pullRequest).pipe(Effect.catch(() => Effect.void))
	})

	const prune = Effect.fn("CacheService.prune")(function* () {
		yield* pruneSql(sql)
	})

	const upsertWorktree = Effect.fn("CacheService.upsertWorktree")(function* (entry: ReviewWorktree) {
		yield* sql`INSERT INTO review_worktrees ${sql.insert({
			pr_key: entry.prKey,
			worktree_path: entry.worktreePath,
			branch_name: entry.branchName,
			created_at: entry.createdAt.toISOString(),
		})} ON CONFLICT(pr_key) DO UPDATE SET
			worktree_path = excluded.worktree_path,
			branch_name = excluded.branch_name,
			created_at = excluded.created_at`.pipe(Effect.catch(() => Effect.void))
	})

	const listWorktrees = (): Effect.Effect<readonly ReviewWorktree[], CacheError> =>
		sql<ReviewWorktreeRow>`SELECT pr_key, worktree_path, branch_name, created_at FROM review_worktrees`.pipe(
			Effect.map((rows) =>
				rows.map((row) => ({
					prKey: row.pr_key,
					worktreePath: row.worktree_path,
					branchName: row.branch_name,
					createdAt: new Date(row.created_at),
				})),
			),
			Effect.mapError((cause) => toCacheError("listWorktrees", cause)),
		)

	const deleteWorktree = Effect.fn("CacheService.deleteWorktree")(function* (prKey: string) {
		yield* sql`DELETE FROM review_worktrees WHERE pr_key = ${prKey}`.pipe(Effect.catch(() => Effect.void))
	})

	const upsertSession = Effect.fn("CacheService.upsertSession")(function* (session: ReviewSession) {
		yield* sql`INSERT INTO review_sessions ${sql.insert({
			session_id: session.sessionId,
			pr_key: session.prKey,
			worktree_path: session.worktreePath,
			session_type: session.sessionType,
			agent_name: session.agentName,
			started_at: session.startedAt.toISOString(),
			ended_at: session.endedAt?.toISOString() ?? null,
			stop_reason: session.stopReason ?? null,
		})} ON CONFLICT(session_id) DO UPDATE SET
			ended_at = excluded.ended_at,
			stop_reason = excluded.stop_reason`.pipe(Effect.catch(() => Effect.void))
	})

	const endSession = Effect.fn("CacheService.endSession")(function* (sessionId: string, endedAt: Date, stopReason?: string) {
		yield* sql`UPDATE review_sessions SET
			ended_at = ${endedAt.toISOString()},
			stop_reason = ${stopReason ?? null}
			WHERE session_id = ${sessionId}`.pipe(Effect.catch(() => Effect.void))
	})

	const listSessions = (prKey: string): Effect.Effect<readonly ReviewSession[], CacheError> =>
		sql<ReviewSessionRow>`SELECT session_id, pr_key, worktree_path, session_type, agent_name, started_at, ended_at, stop_reason
			FROM review_sessions WHERE pr_key = ${prKey} ORDER BY started_at DESC`.pipe(
			Effect.map((rows) =>
				rows.map((row) => ({
					sessionId: row.session_id,
					prKey: row.pr_key,
					worktreePath: row.worktree_path,
					sessionType: row.session_type as ReviewSession["sessionType"],
					agentName: row.agent_name,
					startedAt: new Date(row.started_at),
					endedAt: row.ended_at ? new Date(row.ended_at) : null,
					stopReason: row.stop_reason,
				})),
			),
			Effect.mapError((cause) => toCacheError("listSessions", cause)),
		)

	const appendMessage = Effect.fn("CacheService.appendMessage")(function* (msg: SessionMessage) {
		yield* sql`INSERT INTO session_messages ${sql.insert({
			id: msg.id,
			session_id: msg.sessionId,
			role: msg.role,
			content: msg.content,
			created_at: msg.createdAt.toISOString(),
		})} ON CONFLICT(id) DO NOTHING`.pipe(Effect.catch(() => Effect.void))
	})

	const listMessages = (sessionId: string): Effect.Effect<readonly SessionMessage[], CacheError> =>
		sql<SessionMessageRow>`SELECT id, session_id, role, content, created_at
			FROM session_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`.pipe(
			Effect.map((rows) =>
				rows.map((row) => ({
					id: row.id,
					sessionId: row.session_id,
					role: row.role as SessionMessage["role"],
					content: row.content,
					createdAt: new Date(row.created_at),
				})),
			),
			Effect.mapError((cause) => toCacheError("listMessages", cause)),
		)

	const upsertReport = Effect.fn("CacheService.upsertReport")(function* (report: ReviewReport) {
		yield* sql`INSERT INTO review_reports ${sql.insert({
			session_id: report.sessionId,
			pr_key: report.prKey,
			verdict: report.verdict,
			report_md: report.reportMd,
			canonical_path: report.canonicalPath,
			submitted_at: report.submittedAt.toISOString(),
		})} ON CONFLICT(session_id) DO UPDATE SET
			verdict = excluded.verdict,
			report_md = excluded.report_md,
			canonical_path = excluded.canonical_path,
			submitted_at = excluded.submitted_at`.pipe(Effect.catch(() => Effect.void))
	})

	const getReport = (sessionId: string): Effect.Effect<ReviewReport | null, CacheError> =>
		sql<ReviewReportRow>`SELECT session_id, pr_key, verdict, report_md, canonical_path, submitted_at
			FROM review_reports WHERE session_id = ${sessionId} LIMIT 1`.pipe(
			Effect.map((rows) => {
				const row = rows[0]
				if (!row) return null
				return {
					sessionId: row.session_id,
					prKey: row.pr_key,
					verdict: row.verdict as ReviewReport["verdict"],
					reportMd: row.report_md,
					canonicalPath: row.canonical_path,
					submittedAt: new Date(row.submitted_at),
				}
			}),
			Effect.mapError((cause) => toCacheError("getReport", cause)),
		)

	const upsertFinding = Effect.fn("CacheService.upsertFinding")(function* (finding: ReviewFinding) {
		yield* sql`INSERT INTO review_findings ${sql.insert({
			id: finding.id,
			pr_key: finding.prKey,
			session_id: finding.sessionId ?? null,
			head_ref_oid: finding.headRefOid,
			source: finding.source,
			file_path: finding.filePath ?? null,
			line_start: finding.lineStart ?? null,
			line_end: finding.lineEnd ?? null,
			diff_side: finding.diffSide ?? null,
			title: finding.title ?? null,
			body: finding.body,
			severity: finding.severity ?? null,
			status: finding.status,
			modified_body: finding.modifiedBody ?? null,
			posted_url: finding.postedUrl ?? null,
			created_at: finding.createdAt.toISOString(),
			updated_at: finding.updatedAt.toISOString(),
		})} ON CONFLICT(id) DO UPDATE SET
			status = excluded.status,
			modified_body = excluded.modified_body,
			posted_url = excluded.posted_url,
			updated_at = excluded.updated_at`.pipe(Effect.catch(() => Effect.void))
	})

	const listFindings = (prKey: string): Effect.Effect<readonly ReviewFinding[], CacheError> =>
		sql<ReviewFindingRow>`SELECT id, pr_key, session_id, head_ref_oid, source, file_path,
				line_start, line_end, diff_side, title, body, severity, status, modified_body, posted_url,
				created_at, updated_at
			FROM review_findings WHERE pr_key = ${prKey} ORDER BY created_at ASC`.pipe(
			Effect.map((rows) =>
				rows.map((row) => ({
					id: row.id,
					prKey: row.pr_key,
					sessionId: row.session_id,
					headRefOid: row.head_ref_oid,
					source: row.source as ReviewFinding["source"],
					filePath: row.file_path,
					lineStart: row.line_start,
					lineEnd: row.line_end,
					diffSide: row.diff_side as ReviewFinding["diffSide"],
					title: row.title,
					body: row.body,
					severity: row.severity as ReviewFinding["severity"],
					status: row.status as ReviewFinding["status"],
					modifiedBody: row.modified_body,
					postedUrl: row.posted_url,
					createdAt: new Date(row.created_at),
					updatedAt: new Date(row.updated_at),
				})),
			),
			Effect.mapError((cause) => toCacheError("listFindings", cause)),
		)

	const updateFindingStatus = Effect.fn("CacheService.updateFindingStatus")(function* (id: string, status: FindingStatus, modifiedBody?: string) {
		yield* sql`UPDATE review_findings SET
			status = ${status},
			modified_body = ${modifiedBody ?? null},
			updated_at = ${new Date().toISOString()}
			WHERE id = ${id}`.pipe(Effect.catch(() => Effect.void))
	})

	const markFindingPosted = Effect.fn("CacheService.markFindingPosted")(function* (id: string, url: string) {
		yield* sql`UPDATE review_findings SET
			posted_url = ${url},
			updated_at = ${new Date().toISOString()}
			WHERE id = ${id}`.pipe(Effect.catch(() => Effect.void))
	})

	return {
		readQueue,
		writeQueue,
		readPullRequest,
		upsertPullRequest,
		prune,
		upsertWorktree,
		listWorktrees,
		deleteWorktree,
		upsertSession,
		endSession,
		listSessions,
		appendMessage,
		listMessages,
		upsertReport,
		getReport,
		upsertFinding,
		listFindings,
		updateFindingStatus,
		markFindingPosted,
	}
}

export class CacheService extends Context.Service<
	CacheService,
	{
		readonly readQueue: (viewer: string, view: PullRequestView) => Effect.Effect<PullRequestLoad | null, CacheError>
		readonly writeQueue: (viewer: string, load: PullRequestLoad) => Effect.Effect<void>
		readonly readPullRequest: (key: PullRequestCacheKey) => Effect.Effect<PullRequestItem | null, CacheError>
		readonly upsertPullRequest: (pullRequest: PullRequestItem) => Effect.Effect<void>
		readonly prune: () => Effect.Effect<void>
		readonly upsertWorktree: (entry: ReviewWorktree) => Effect.Effect<void, never>
		readonly listWorktrees: () => Effect.Effect<readonly ReviewWorktree[], CacheError>
		readonly deleteWorktree: (prKey: string) => Effect.Effect<void, never>
		readonly upsertSession: (session: ReviewSession) => Effect.Effect<void, never>
		readonly endSession: (sessionId: string, endedAt: Date, stopReason?: string) => Effect.Effect<void, never>
		readonly listSessions: (prKey: string) => Effect.Effect<readonly ReviewSession[], CacheError>
		readonly appendMessage: (msg: SessionMessage) => Effect.Effect<void, never>
		readonly listMessages: (sessionId: string) => Effect.Effect<readonly SessionMessage[], CacheError>
		readonly upsertReport: (report: ReviewReport) => Effect.Effect<void, never>
		readonly getReport: (sessionId: string) => Effect.Effect<ReviewReport | null, CacheError>
		readonly upsertFinding: (finding: ReviewFinding) => Effect.Effect<void, never>
		readonly listFindings: (prKey: string) => Effect.Effect<readonly ReviewFinding[], CacheError>
		readonly updateFindingStatus: (id: string, status: FindingStatus, modifiedBody?: string) => Effect.Effect<void, never>
		readonly markFindingPosted: (id: string, url: string) => Effect.Effect<void, never>
	}
>()("ghui/CacheService") {
	static readonly disabledLayer = Layer.succeed(
		CacheService,
		CacheService.of({
			readQueue: () => Effect.succeed(null),
			writeQueue: () => Effect.void,
			readPullRequest: () => Effect.succeed(null),
			upsertPullRequest: () => Effect.void,
			prune: () => Effect.void,
			upsertWorktree: () => Effect.void,
			listWorktrees: () => Effect.succeed([]),
			deleteWorktree: () => Effect.void,
			upsertSession: () => Effect.void,
			endSession: () => Effect.void,
			listSessions: () => Effect.succeed([]),
			appendMessage: () => Effect.void,
			listMessages: () => Effect.succeed([]),
			upsertReport: () => Effect.void,
			getReport: () => Effect.succeed(null),
			upsertFinding: () => Effect.void,
			listFindings: () => Effect.succeed([]),
			updateFindingStatus: () => Effect.void,
			markFindingPosted: () => Effect.void,
		}),
	)

	static readonly layerSqlite = Layer.effect(
		CacheService,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient
			return CacheService.of(liveCacheService(sql))
		}),
	)
}
