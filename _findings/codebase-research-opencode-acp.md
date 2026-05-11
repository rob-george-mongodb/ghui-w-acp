# Codebase Research: OpenCode ACP (Agent Client Protocol)

## Research Question
How does ACP work in opencode? How is `opencode acp` invoked, what is the communication protocol, how are tools/plugins registered, and how can an external process receive tool call events?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `find -name "*acp*"` | 19 files | 1 CLI cmd, 4 src files, rest are docs translations |
| 2 | `grep "ndJsonStream\|AgentSideConnection"` | 3 files | acp.ts CLI, agent.ts, test file |
| 3 | `find -path "*/tool/*" -name "*.ts"` | 20+ files | Built-in tools (read, glob, shell, etc.) |
| 4 | `grep "plugin\|Plugin"` in src | 30+ files | Plugin system spread across config/plugin, plugin/* |
| 5 | `find -path "*/acp/*"` | 4 files | agent.ts, session.ts, types.ts, README.md |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/opencode/src/cli/cmd/acp.ts` | CLI entry point — starts ACP server | L1-73 |
| 2 | `packages/opencode/src/acp/agent.ts` | Core ACP agent — implements full protocol | L1-1504+ |
| 3 | `packages/opencode/src/acp/session.ts` | ACP session state management | L1-122 |
| 4 | `packages/opencode/src/acp/types.ts` | Type definitions (ACPSessionState, ACPConfig) | L1-24 |
| 5 | `packages/opencode/src/tool/tool.ts` | Tool definition interface (Def, Info, Context) | L1-162 |
| 6 | `packages/opencode/src/config/plugin.ts` | Plugin loading from config/filesystem | L1-88 |
| 7 | `packages/opencode/src/plugin/index.ts` | Plugin system (hooks, init, trigger) | L1-288 |
| 8 | `packages/opencode/src/server/server.ts` | HTTP server that ACP cmd starts internally | L1-158 |
| 9 | `packages/opencode/src/server/routes/instance/httpapi/event.ts` | SSE event stream (Bus → HTTP) | L1-79 |
| 10 | `packages/web/src/content/docs/acp.mdx` | Official ACP documentation | L1-156 |

## Code Path Map

### Entry Point: `opencode acp` CLI command (`packages/opencode/src/cli/cmd/acp.ts:L13`)

1. Sets `process.env.OPENCODE_CLIENT = "acp"` (L24)
2. Starts internal HTTP server via `Server.listen(opts)` (L26) — this hosts the opencode REST API
3. Creates an `OpencodeClient` SDK pointing at `http://{host}:{port}` with auth headers (L28-31)
4. Wires **stdin** as a `ReadableStream` and **stdout** as a `WritableStream` (L33-54)
5. Creates an `ndJsonStream(input, output)` — newline-delimited JSON transport over stdio (L56)
6. Initializes `ACP.init({ sdk })` which returns an agent factory (L57)
7. Creates `new AgentSideConnection(callback, stream)` from `@agentclientprotocol/sdk` (L59-61)
   - The callback receives the connection and creates an `Agent` instance
8. Blocks on stdin until EOF (L64-71)

### Communication Protocol: JSON-RPC over stdio via ndJSON

- **Transport**: stdin/stdout, newline-delimited JSON (`ndJsonStream`)
- **Protocol**: ACP v1 — JSON-RPC 2.0 messages
- **SDK**: `@agentclientprotocol/sdk` handles framing, method dispatch
- **Key methods implemented by `Agent` class** (`agent.ts`):
  - `initialize` → returns capabilities, auth methods, agent info (L508-553)
  - `newSession` → creates session via internal SDK (L559-592)
  - `loadSession` → restores session + replays messages (L594-632)
  - `listSessions` → lists sessions with pagination (L634-677)
  - `unstable_forkSession` → forks a session (L679-731)
  - `resumeSession` → resumes existing session (L733-765)
  - `closeSession` → aborts + removes session (L767-786)
  - `prompt` → sends user message, returns response (L1321-1502)
  - `cancel` → aborts running session (L1504+)
  - `setSessionMode` → switches agent mode (L1260-1267)
  - `setSessionConfigOption` → changes model/effort/mode (L1269-1319)
  - `unstable_setSessionModel` → changes model (L1220-1258)

### Event Flow: How tool calls are reported to the ACP client

1. `Agent` constructor starts `runEventSubscription()` (L164-174)
2. This polls `sdk.global.event()` — the opencode HTTP SSE stream (L176-191)
3. Events are dispatched to `handleEvent()` (L193-506):
   - **`permission.asked`** → calls `connection.requestPermission()` to ask the editor for approval (L196-273)
   - **`message.part.updated`** with `part.type === "tool"` → sends tool lifecycle updates (L276-431):
     - `tool_call` (pending) via `toolStart()` (L1045-1064)
     - `tool_call_update` with status `in_progress` (L327-343)
     - `tool_call_update` with status `completed` (L346-397)
     - `tool_call_update` with status `failed` (L398-429)
   - **`message.part.delta`** → streams text/reasoning chunks (L441-504):
     - `agent_message_chunk` for text deltas
     - `agent_thought_chunk` for reasoning deltas

### Tool Call Update Schema (sent via `connection.sessionUpdate`)

```typescript
{
  sessionId: string,
  update: {
    sessionUpdate: "tool_call" | "tool_call_update",
    toolCallId: string,
    status: "pending" | "in_progress" | "completed" | "failed",
    kind: ToolKind,  // mapped from tool name
    title: string,
    rawInput: Record<string, unknown>,
    rawOutput?: Record<string, unknown>,
    locations?: Location[],
    content?: ToolCallContent[],
  }
}
```

### How tools are defined (`packages/opencode/src/tool/tool.ts`)

Tools implement the `Def` interface (L34-43):
```typescript
interface Def<Parameters, Metadata> {
  id: string
  description: string
  parameters: Schema  // Effect Schema for input validation
  execute(args, ctx: Context): Effect<ExecuteResult>
}
```

Tools are registered as `Info` objects with lazy initialization (L49-55):
```typescript
interface Info {
  id: string
  init: () => Effect<DefWithoutID>
}
```

### Plugin System (`packages/opencode/src/plugin/index.ts`, `packages/opencode/src/config/plugin.ts`)

**Loading plugins from filesystem** (`config/plugin.ts:L30-42`):
- Scans `{plugin,plugins}/*.{ts,js}` in the project directory
- Converts to `file://` URLs

**Plugin specs in config**: Either a string (package name or path) or `[string, options]` tuple.

**Built-in plugins** (`plugin/index.ts:L59-67`): Codex, Copilot, GitLab, Poe, Cloudflare, Azure auth plugins.

**Plugin hooks interface** (`plugin/index.ts:L33-53`):
- Plugins export a `Hooks` interface
- Triggered via `Plugin.Service.trigger(name, input, output)`
- Hooks follow `(input, output) => Promise<void>` pattern

### How an external process (like ghui) would use ACP

1. **Spawn**: `opencode acp [--cwd /path] [--port N] [--hostname H]`
2. **Transport**: Read/write ndJSON on the subprocess's stdout/stdin
3. **Protocol**: Use `@agentclientprotocol/sdk` client-side (`ClientSideConnection`)
4. **Session lifecycle**: `initialize` → `session/new` → `session/prompt`
5. **Receive events**: Tool calls arrive as `sessionUpdate` notifications from the agent side
6. **Permissions**: Agent sends `requestPermission` — client must respond with allow/reject
7. **No custom tool registration via ACP**: Tools are internal to opencode (built-in + MCP servers + plugins). External processes observe tool execution but don't define new tools through ACP.

## Architectural Context

- **Module**: `packages/opencode/src/acp/` — 4 files implementing the agent side of ACP
- **Dependencies**:
  - `@agentclientprotocol/sdk` — official ACP TypeScript SDK (provides `AgentSideConnection`, `ndJsonStream`, type definitions)
  - `@opencode-ai/sdk/v2` — opencode's own REST API client (used internally to talk to the HTTP server)
  - `effect` — functional effect system used throughout
- **Internal architecture**: ACP is a **bridge layer**. It spawns opencode's HTTP server internally, then translates between ACP JSON-RPC (stdio) and opencode's REST API (HTTP). The `Agent` class subscribes to opencode's SSE event stream and forwards events as ACP `sessionUpdate` notifications.
- **Configuration**: `--cwd`, `--port`, `--hostname` CLI flags. MCP servers can be passed from the editor via ACP's `mcpServers` parameter.
- **Related Tests**: `packages/opencode/test/acp/event-subscription.test.ts`

## Summary

OpenCode's ACP implementation is a stdio-based JSON-RPC bridge. `opencode acp` starts an internal HTTP server, creates an `OpencodeClient` SDK against it, then uses `@agentclientprotocol/sdk`'s `AgentSideConnection` over ndJSON stdin/stdout to communicate with editors. Tool calls are **not registered** through ACP — they're opencode's built-in tools + configured MCP servers. The ACP layer observes tool execution via SSE events and forwards `tool_call`/`tool_call_update` session updates to the connected editor. An external process like ghui would spawn `opencode acp`, communicate via ndJSON on stdin/stdout using the ACP SDK, and receive tool call notifications as `sessionUpdate` messages. Custom tools are added via the plugin system (`plugin/` or `plugins/` directory with `.ts`/`.js` files, or npm packages in config) — not through ACP itself.
