import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun"
import { Context, Effect, Layer, Schema } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import type { SqlError } from "effect/unstable/sql/SqlError"
import type { FindingStatus, ReviewFinding, ReviewReport, ReviewSession, SessionMessage } from "../domain.js"

export class ACPStoreError extends Schema.TaggedErrorClass<ACPStoreError>()("ACPStoreError", {
	operation: Schema.String,
	cause: Schema.Defect,
}) {}

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

const toACPStoreError = (operation: string, cause: unknown) => (cause instanceof ACPStoreError ? cause : new ACPStoreError({ operation, cause }))

const applyPragmas = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient
	yield* sql`PRAGMA synchronous = NORMAL`
	yield* sql`PRAGMA busy_timeout = 5000`
	yield* sql`PRAGMA foreign_keys = ON`
	yield* sql`PRAGMA temp_store = MEMORY`
	yield* sql`PRAGMA journal_size_limit = 16777216`
})

const acpMigrations = {
	"001_acp_schema": Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient
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

const liveACPStore = (sql: SqlClient.SqlClient) => {
	const upsertSession = Effect.fn("ACPStore.upsertSession")(function* (session: ReviewSession) {
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

	const endSession = Effect.fn("ACPStore.endSession")(function* (sessionId: string, endedAt: Date, stopReason?: string) {
		yield* sql`UPDATE review_sessions SET
			ended_at = ${endedAt.toISOString()},
			stop_reason = ${stopReason ?? null}
			WHERE session_id = ${sessionId}`.pipe(Effect.catch(() => Effect.void))
	})

	const listSessions = (prKey: string): Effect.Effect<readonly ReviewSession[], ACPStoreError> =>
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
			Effect.mapError((cause) => toACPStoreError("listSessions", cause)),
		)

	const appendMessage = Effect.fn("ACPStore.appendMessage")(function* (msg: SessionMessage) {
		yield* sql`INSERT INTO session_messages ${sql.insert({
			id: msg.id,
			session_id: msg.sessionId,
			role: msg.role,
			content: msg.content,
			created_at: msg.createdAt.toISOString(),
		})} ON CONFLICT(id) DO NOTHING`.pipe(Effect.catch(() => Effect.void))
	})

	const listMessages = (sessionId: string): Effect.Effect<readonly SessionMessage[], ACPStoreError> =>
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
			Effect.mapError((cause) => toACPStoreError("listMessages", cause)),
		)

	const upsertReport = Effect.fn("ACPStore.upsertReport")(function* (report: ReviewReport) {
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

	const getReport = (sessionId: string): Effect.Effect<ReviewReport | null, ACPStoreError> =>
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
			Effect.mapError((cause) => toACPStoreError("getReport", cause)),
		)

	const upsertFinding = Effect.fn("ACPStore.upsertFinding")(function* (finding: ReviewFinding) {
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

	const listFindings = (prKey: string): Effect.Effect<readonly ReviewFinding[], ACPStoreError> =>
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
			Effect.mapError((cause) => toACPStoreError("listFindings", cause)),
		)

	const updateFindingStatus = Effect.fn("ACPStore.updateFindingStatus")(function* (id: string, status: FindingStatus, modifiedBody?: string) {
		yield* sql`UPDATE review_findings SET
			status = ${status},
			modified_body = ${modifiedBody ?? null},
			updated_at = ${new Date().toISOString()}
			WHERE id = ${id}`.pipe(Effect.catch(() => Effect.void))
	})

	const markFindingPosted = Effect.fn("ACPStore.markFindingPosted")(function* (id: string, url: string) {
		yield* sql`UPDATE review_findings SET
			posted_url = ${url},
			updated_at = ${new Date().toISOString()}
			WHERE id = ${id}`.pipe(Effect.catch(() => Effect.void))
	})

	return {
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

export class ACPStore extends Context.Service<
	ACPStore,
	{
		readonly upsertSession: (session: ReviewSession) => Effect.Effect<void, never>
		readonly endSession: (sessionId: string, endedAt: Date, stopReason?: string) => Effect.Effect<void, never>
		readonly listSessions: (prKey: string) => Effect.Effect<readonly ReviewSession[], ACPStoreError>
		readonly appendMessage: (msg: SessionMessage) => Effect.Effect<void, never>
		readonly listMessages: (sessionId: string) => Effect.Effect<readonly SessionMessage[], ACPStoreError>
		readonly upsertReport: (report: ReviewReport) => Effect.Effect<void, never>
		readonly getReport: (sessionId: string) => Effect.Effect<ReviewReport | null, ACPStoreError>
		readonly upsertFinding: (finding: ReviewFinding) => Effect.Effect<void, never>
		readonly listFindings: (prKey: string) => Effect.Effect<readonly ReviewFinding[], ACPStoreError>
		readonly updateFindingStatus: (id: string, status: FindingStatus, modifiedBody?: string) => Effect.Effect<void, never>
		readonly markFindingPosted: (id: string, url: string) => Effect.Effect<void, never>
	}
>()("ghui/ACPStore") {
	static readonly disabledLayer = Layer.succeed(
		ACPStore,
		ACPStore.of({
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
		ACPStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient
			return ACPStore.of(liveACPStore(sql))
		}),
	)

	static readonly layerSqliteFile = (filename: string): Layer.Layer<ACPStore, SqlError | Migrator.MigrationError | ACPStoreError> => {
		const sqlLayer = SqliteClient.layer({ filename })
		const setupLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				yield* applyPragmas
				yield* SqliteMigrator.run({ loader: Migrator.fromRecord(acpMigrations), table: "ghui_acp_migrations" })
			}),
		)
		const liveLayer = Layer.mergeAll(setupLayer, ACPStore.layerSqlite).pipe(Layer.provide(sqlLayer))
		return Layer.unwrap(
			Effect.tryPromise({
				try: () => mkdir(dirname(filename), { recursive: true }),
				catch: (cause) => new ACPStoreError({ operation: "createACPStoreDirectory", cause }),
			}).pipe(Effect.as(liveLayer)),
		)
	}

	static readonly layerFromPath = (filename: string | null): Layer.Layer<ACPStore> =>
		filename === null ? ACPStore.disabledLayer : ACPStore.layerSqliteFile(filename).pipe(Layer.catchCause(() => ACPStore.disabledLayer))
}
