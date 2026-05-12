import { randomUUID } from "node:crypto"
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Database } from "bun:sqlite"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

const REVIEW_DIR = process.env.GHUI_REVIEW_DIR
const PR_KEY = process.env.GHUI_PR_KEY
const SESSION_ID = process.env.GHUI_SESSION_ID
const ACP_STORE_PATH = process.env.GHUI_ACP_STORE_PATH

const getSessionId = (): string => {
	if (SESSION_ID) return SESSION_ID
	try {
		const idFile = `${REVIEW_DIR}/.session-id`
		if (existsSync(idFile)) {
			return readFileSync(idFile, "utf8").trim()
		}
	} catch {
		// ignore
	}
	return randomUUID()
}

const tools = [
	{
		name: "report_finding",
		description: "Report a significant PR review finding that may warrant a comment.",
		inputSchema: {
			type: "object" as const,
			properties: {
				title: { type: "string", description: "One-line summary" },
				body: { type: "string", description: "Markdown comment text" },
				severity: { type: "string", enum: ["info", "warning", "error", "blocking"] },
				file_path: { type: "string", description: "Repo-relative path; omit for PR-level comments" },
				line_start: { type: "integer" },
				line_end: { type: "integer" },
				diff_side: {
					type: "string",
					enum: ["LEFT", "RIGHT"],
					description: "Diff side. Defaults to RIGHT (new file). Use LEFT for deleted lines.",
				},
			},
			required: ["title", "body", "severity"],
		},
	},
	{
		name: "submit_pr_report",
		description: "Submit a full PR review report with an overall verdict. Write your report to a Markdown file first, then call this tool with the file path.",
		inputSchema: {
			type: "object" as const,
			properties: {
				report_path: {
					type: "string",
					description: "Path to the Markdown report file you have written, relative to your working directory.",
				},
				verdict: {
					type: "string",
					enum: ["indeterminate_human_review_required", "good_for_merge", "block_merge", "minor_issues"],
					description: "Overall assessment of the PR.",
				},
			},
			required: ["report_path", "verdict"],
		},
	},
]

export const runMcpServer = async () => {
	if (!REVIEW_DIR) {
		process.stderr.write("GHUI_REVIEW_DIR is required\n")
		process.exit(1)
	}

	mkdirSync(REVIEW_DIR, { recursive: true })

	const server = new Server({ name: "ghui-review", version: "1.0.0" }, { capabilities: { tools: {} } })

	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params

		if (name === "report_finding") {
			const id = randomUUID()
			const now = new Date().toISOString()
			const finding = {
				id,
				prKey: PR_KEY ?? "",
				sessionId: getSessionId() || null,
				source: "ai",
				title: args?.title ?? null,
				body: args?.body ?? "",
				severity: args?.severity ?? null,
				filePath: args?.file_path ?? null,
				lineStart: args?.line_start ?? null,
				lineEnd: args?.line_end ?? null,
				diffSide: args?.diff_side ?? null,
				createdAt: now,
			}
			const findingsPath = `${REVIEW_DIR}/findings.jsonl`
			appendFileSync(findingsPath, JSON.stringify(finding) + "\n")
			return { content: [{ type: "text" as const, text: JSON.stringify({ id, status: "recorded" }) }] }
		}

		if (name === "submit_pr_report") {
			const reportPath = args?.report_path
			if (!reportPath || typeof reportPath !== "string") {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ error: "report_path is required" }) }],
					isError: true,
				}
			}

			const absoluteReportPath = resolve(process.cwd(), reportPath)
			if (!existsSync(absoluteReportPath)) {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${reportPath}` }) }],
					isError: true,
				}
			}

			const verdict = args?.verdict
			if (!verdict || typeof verdict !== "string") {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ error: "verdict is required" }) }],
					isError: true,
				}
			}

			const sessionId = getSessionId()
			const canonicalName = `report-${sessionId}.md`
			const canonicalPath = `${REVIEW_DIR}/${canonicalName}`

			let reportMd: string
			try {
				reportMd = readFileSync(absoluteReportPath, "utf8")
			} catch {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ error: `Cannot read file: ${reportPath}` }) }],
					isError: true,
				}
			}

			copyFileSync(absoluteReportPath, canonicalPath)

			if (ACP_STORE_PATH) {
				try {
					const db = new Database(ACP_STORE_PATH)
					db.run(
						`INSERT INTO review_reports (session_id, pr_key, verdict, report_md, canonical_path, submitted_at)
						 VALUES (?, ?, ?, ?, ?, ?)
						 ON CONFLICT(session_id) DO UPDATE SET
						   verdict = excluded.verdict,
						   report_md = excluded.report_md,
						   canonical_path = excluded.canonical_path,
						   submitted_at = excluded.submitted_at`,
						[sessionId, PR_KEY ?? "", verdict, reportMd, `.ghui-review/${canonicalName}`, new Date().toISOString()],
					)
					db.close()
				} catch {
					// best-effort SQLite write
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ status: "submitted", canonical_path: `.ghui-review/${canonicalName}` }),
					},
				],
			}
		}

		return {
			content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
			isError: true,
		}
	})

	const transport = new StdioServerTransport()
	await server.connect(transport)
}
