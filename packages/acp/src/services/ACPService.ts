import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { Readable, Writable } from "node:stream"
import * as acp from "@agentclientprotocol/sdk"
import type { RequestPermissionRequest, RequestPermissionResponse, SessionNotification } from "@agentclientprotocol/sdk"
import { Context, Effect, Fiber, Layer, Schema } from "effect"
import type { ReviewSession } from "../domain.js"
import { ACPStore } from "./ACPStore.js"
import { ReviewWatcher } from "./ReviewWatcher.js"

export class ACPError extends Schema.TaggedErrorClass<ACPError>()("ACPError", {
	cause: Schema.Defect,
	message: Schema.String,
}) {}

export interface ACPAgentConfig {
	readonly name: string
	readonly command: readonly string[]
	readonly defaultModel?: string
}

export interface ACPConfig {
	readonly agents: readonly ACPAgentConfig[]
	readonly defaultAgent?: string
	readonly storePath?: string | null
}

export class ACPConfigService extends Context.Service<ACPConfigService, ACPConfig>()("ghui/ACPConfig") {}

export interface ACPPrRef {
	readonly repository: string
	readonly number: number
}

interface Accumulator {
	text: string
}

interface SessionHandle {
	proc: ReturnType<typeof spawn>
	connection: acp.ClientSideConnection
	prKey: string
	worktreePath: string
	reviewDir: string
	sessionType: "review" | "chat"
	agentName: string
	accumulator: Accumulator
	watcherFiber: Fiber.Fiber<unknown, unknown> | null
	lastWatcherOffset: number
	lastStopReason: string | null
}

export class ACPService extends Context.Service<
	ACPService,
	{
		readonly startReviewSession: (pr: ACPPrRef, worktreePath: string) => Effect.Effect<ReviewSession, ACPError>
		readonly startChatSession: (pr: ACPPrRef, worktreePath: string) => Effect.Effect<ReviewSession, ACPError>
		readonly sendPrompt: (sessionId: string, text: string) => Effect.Effect<{ stopReason: string }, ACPError>
		readonly cancelSession: (sessionId: string) => Effect.Effect<void, never>
		readonly closeSession: (sessionId: string) => Effect.Effect<void, never>
	}
>()("ghui/ACPService") {
	static readonly layer: Layer.Layer<ACPService, never, ACPConfigService | ACPStore | ReviewWatcher> = Layer.effect(
		ACPService,
		Effect.gen(function* () {
			const config = yield* ACPConfigService
			const store = yield* ACPStore
			const watcher = yield* ReviewWatcher

			const handles = new Map<string, SessionHandle>()

			const cleanup = () => {
				for (const [, h] of handles) {
					try {
						h.proc.kill("SIGTERM")
					} catch {}
				}
			}
			process.on("exit", cleanup)
			process.on("SIGTERM", () => {
				cleanup()
				process.exit(0)
			})
			process.on("SIGINT", () => {
				cleanup()
				process.exit(0)
			})

			const getAgentConfig = () => {
				const agents = config.agents ?? []
				const defaultName = config.defaultAgent
				return agents.find((a) => a.name === defaultName) ?? agents[0] ?? { name: "opencode", command: ["opencode", "acp"] }
			}

			const createSession = (pr: ACPPrRef, worktreePath: string, sessionType: "review" | "chat"): Effect.Effect<ReviewSession, ACPError> =>
				Effect.gen(function* () {
					const agentConfig = getAgentConfig()
					const pk = `${pr.repository}#${pr.number}`
					const reviewDir = join(worktreePath, ".ghui-review")
					const agentCmd = agentConfig.command[0] ?? "opencode"
					const agentArgs = [...agentConfig.command.slice(1), "--cwd", worktreePath]

					const proc = spawn(agentCmd, agentArgs, { stdio: ["pipe", "pipe", "inherit"] })

					const accumulator: Accumulator = { text: "" }

					const input = Writable.toWeb(proc.stdin!)
					const output = Readable.toWeb(proc.stdout!) as unknown as ReadableStream<Uint8Array>
					const stream = acp.ndJsonStream(input, output)

					const connection = new acp.ClientSideConnection(
						() => ({
							sessionUpdate: async (params: SessionNotification): Promise<void> => {
								const update = params.update
								if (update.sessionUpdate === "agent_message_chunk") {
									const block = update.content
									if (block.type === "text") {
										accumulator.text += block.text
									}
								}
							},
							requestPermission: async (params: RequestPermissionRequest): Promise<RequestPermissionResponse> => {
								const allowOption = params.options.find((opt) => opt.kind === "allow_once")
								if (allowOption) {
									return { outcome: { outcome: "selected", optionId: allowOption.optionId } }
								}
								return { outcome: { outcome: "cancelled" } }
							},
						}),
						stream,
					)

					yield* Effect.tryPromise({
						try: () => connection.initialize({ protocolVersion: acp.PROTOCOL_VERSION, clientCapabilities: {} }),
						catch: (e) => new ACPError({ cause: e, message: `ACP initialize failed: ${String(e)}` }),
					})

					const sessionResp = yield* Effect.tryPromise({
						try: () =>
							connection.newSession({
								cwd: worktreePath,
								mcpServers: [
									{
										name: "ghui-review",
										command: process.execPath,
										args: ["mcp-server"],
										env: [
											{ name: "GHUI_REVIEW_DIR", value: reviewDir },
											{ name: "GHUI_PR_KEY", value: pk },
											{ name: "GHUI_SESSION_ID", value: "" },
											{ name: "GHUI_ACP_STORE_PATH", value: config.storePath ?? "" },
										],
									},
								],
							}),
						catch: (e) => new ACPError({ cause: e, message: `ACP newSession failed: ${String(e)}` }),
					})

					const acpSessionId = sessionResp.sessionId

					try {
						writeFileSync(join(reviewDir, ".session-id"), acpSessionId)
					} catch {}

					const now = new Date()
					const session: ReviewSession = {
						sessionId: acpSessionId,
						prKey: pk,
						worktreePath,
						sessionType,
						agentName: agentConfig.name,
						startedAt: now,
						endedAt: null,
						stopReason: null,
					}

					yield* store.upsertSession(session)

					handles.set(acpSessionId, {
						proc,
						connection,
						prKey: pk,
						worktreePath,
						reviewDir,
						sessionType,
						agentName: agentConfig.name,
						accumulator,
						watcherFiber: null,
						lastWatcherOffset: 0,
						lastStopReason: null,
					})

					return session
				})

			const startReviewSession = (pr: ACPPrRef, worktreePath: string) => createSession(pr, worktreePath, "review")

			const startChatSession = (pr: ACPPrRef, worktreePath: string) => createSession(pr, worktreePath, "chat")

			const sendPrompt = (sessionId: string, text: string): Effect.Effect<{ stopReason: string }, ACPError> =>
				Effect.gen(function* () {
					const handle = handles.get(sessionId)
					if (!handle) {
						return yield* Effect.fail(new ACPError({ cause: new Error("Session not found"), message: `No active session: ${sessionId}` }))
					}

					yield* store.appendMessage({
						id: randomUUID(),
						sessionId,
						role: "user",
						content: text,
						createdAt: new Date(),
					})

					const watcherFiber = yield* watcher
						.watch({
							reviewDir: handle.reviewDir,
							prKey: handle.prKey,
							sessionId,
							headRefOid: "",
							initialOffset: handle.lastWatcherOffset,
						})
						.pipe(Effect.forkChild)
					handle.watcherFiber = watcherFiber

					handle.accumulator.text = ""

					const result = yield* Effect.tryPromise({
						try: () =>
							handle.connection.prompt({
								sessionId,
								prompt: [{ type: "text", text }],
							}),
						catch: (e) => new ACPError({ cause: e, message: `ACP prompt failed: ${String(e)}` }),
					}).pipe(
						Effect.ensuring(
							Fiber.interrupt(watcherFiber).pipe(
								Effect.ignore,
								Effect.tap(() =>
									Effect.sync(() => {
										handle.watcherFiber = null
									}),
								),
							),
						),
					)

					handle.lastWatcherOffset = yield* watcher.finalSweep({
						reviewDir: handle.reviewDir,
						prKey: handle.prKey,
						sessionId,
						headRefOid: "",
						lastOffset: handle.lastWatcherOffset,
					})

					if (handle.accumulator.text) {
						yield* store.appendMessage({
							id: randomUUID(),
							sessionId,
							role: "assistant",
							content: handle.accumulator.text,
							createdAt: new Date(),
						})
					}

					handle.lastStopReason = result.stopReason

					return { stopReason: result.stopReason }
				})

			const cancelSession = (sessionId: string): Effect.Effect<void, never> =>
				Effect.gen(function* () {
					const handle = handles.get(sessionId)
					if (!handle) return
					yield* Effect.tryPromise({
						try: () => handle.connection.cancel({ sessionId }),
						catch: () => undefined,
					}).pipe(Effect.ignore)
				})

			const closeSession = (sessionId: string): Effect.Effect<void, never> =>
				Effect.gen(function* () {
					const handle = handles.get(sessionId)
					if (!handle) return
					if (handle.watcherFiber) {
						yield* Fiber.interrupt(handle.watcherFiber).pipe(Effect.ignore)
					}
					yield* store.endSession(sessionId, new Date(), handle.lastStopReason ?? undefined).pipe(Effect.ignore)
					try {
						handle.proc.kill("SIGTERM")
					} catch {}
					handles.delete(sessionId)
				})

			return ACPService.of({ startReviewSession, startChatSession, sendPrompt, cancelSession, closeSession })
		}),
	)
}
