# Codebase Research: ACP TypeScript SDK API Surface

## Research Question
What is the full API surface of the ACP TypeScript SDK? How does a client expose tools to an agent? How do sessions, tool calls, and transport work?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | Directory listing of `src/` | 8 entries | Core: `acp.ts`, `jsonrpc.ts`, `stream.ts`, `schema/` |
| 2 | `src/schema/` listing | 3 files | `index.ts`, `types.gen.ts`, `zod.gen.ts` |
| 3 | `src/examples/` listing | 2 examples | `agent.ts`, `client.ts` |
| 4 | `ToolCall\|ToolCallUpdate\|RequestPermission\|mcpServers` in types.gen.ts | 21 matches | Key tool call types identified |
| 5 | `NewSessionRequest\|McpServer\|SessionNotification\|RequestPermissionRequest` | 4 matches | Located session and permission types |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `src/acp.ts` | **Main SDK entry point** — exports `AgentSideConnection`, `ClientSideConnection`, `Agent` interface, `Client` interface, `Connection`, `RequestError`, `TerminalHandle` | Full file (2270 lines) |
| 2 | `src/stream.ts` | Transport layer — `Stream` type + `ndJsonStream()` for stdio NDJSON | Full file (99 lines) |
| 3 | `src/jsonrpc.ts` | JSON-RPC 2.0 message types | Full file (46 lines) |
| 4 | `src/schema/index.ts` | All type re-exports + `AGENT_METHODS`, `CLIENT_METHODS`, `PROTOCOL_VERSION` | Full file (289 lines) |
| 5 | `src/schema/types.gen.ts` | Auto-generated types for all protocol messages | 5683 lines |
| 6 | `src/examples/agent.ts` | Example agent implementation | Full file (276 lines) |
| 7 | `src/examples/client.ts` | Example client implementation — **this is what ghui needs to model** | Full file (168 lines) |
| 8 | `src/acp.test.ts` | Comprehensive tests showing bidirectional communication | 1700+ lines |

## Architecture Overview

### Protocol Model: ACP is NOT like MCP for tool registration

**Critical finding for ghui:** ACP does **not** have a mechanism for the client to register/expose tools that the agent calls. The protocol works differently:

1. **The Agent owns all tools.** The agent decides what tools to use internally.
2. **The Agent sends `session/update` notifications** with `tool_call` and `tool_call_update` session updates to **inform** the client what it's doing.
3. **The Agent requests permission** via `session/request_permission` when it wants to execute a sensitive tool — the client approves/rejects.
4. **The Client provides file system and terminal access** — these are fixed capabilities, not extensible tool registration.

### Two Connection Classes

```
┌─────────────────────────┐     stdio/NDJSON      ┌──────────────────────────┐
│  ClientSideConnection   │ ◄──────────────────► │  AgentSideConnection     │
│  (implements Agent)     │                       │  (provides Client API)   │
│  ghui/Zed uses this     │                       │  Claude Code uses this   │
└─────────────────────────┘                       └──────────────────────────┘
```

- **`ClientSideConnection`** — What an editor (ghui) creates. It can call Agent methods (initialize, newSession, prompt, cancel, etc.).
- **`AgentSideConnection`** — What an agent (Claude Code) creates. It can call Client methods (readTextFile, writeTextFile, requestPermission, sessionUpdate, createTerminal, etc.).

### Session Lifecycle

```
Client                              Agent
  │                                   │
  │──── initialize ──────────────────►│  Negotiate protocol version + capabilities
  │◄─── InitializeResponse ──────────│
  │                                   │
  │──── session/new ─────────────────►│  Create session with cwd + mcpServers
  │◄─── NewSessionResponse ──────────│  Returns sessionId
  │                                   │
  │──── session/prompt ──────────────►│  Send user message
  │     (blocks until turn done)      │
  │                                   │
  │◄─── session/update (notification)│  Agent streams: message chunks, tool calls
  │◄─── session/update (notification)│  ...more chunks/tool calls...
  │                                   │
  │◄─── session/request_permission ──│  Agent asks permission for sensitive tool
  │──── PermissionResponse ──────────►│  User approves/rejects
  │                                   │
  │◄─── session/update (notification)│  Tool result
  │◄─── PromptResponse ─────────────│  Turn complete (stopReason)
  │                                   │
  │──── session/cancel (notification)►│  Cancel ongoing turn
  │──── session/close ───────────────►│  End session
```

### Agent Methods (Client → Agent requests)

From `AGENT_METHODS` in `src/schema/index.ts`:

| Method | Purpose |
|--------|---------|
| `initialize` | Negotiate protocol version + capabilities |
| `authenticate` | Auth the client |
| `session/new` | Create new session |
| `session/load` | Resume session with full history replay |
| `session/resume` | Resume session without history replay |
| `session/list` | List existing sessions |
| `session/fork` | Fork a session (UNSTABLE) |
| `session/close` | Close session |
| `session/prompt` | Send user prompt (long-running, blocks until done) |
| `session/cancel` | Cancel ongoing prompt (notification) |
| `session/set_mode` | Switch agent mode (ask/code/architect) |
| `session/set_model` | Select model (UNSTABLE) |
| `session/set_config_option` | Set config option |
| `providers/list` | List configurable providers (UNSTABLE) |
| `providers/set` | Configure a provider (UNSTABLE) |
| `providers/disable` | Disable a provider (UNSTABLE) |
| `logout` | Terminate auth session (UNSTABLE) |
| `nes/start`, `nes/suggest`, `nes/close` | Next Edit Suggestions (UNSTABLE) |
| `document/didOpen`, `didChange`, `didClose`, `didSave`, `didFocus` | Document events (UNSTABLE) |
| `nes/accept`, `nes/reject` | NES feedback (UNSTABLE, notifications) |

### Client Methods (Agent → Client requests)

From `CLIENT_METHODS` in `src/schema/index.ts`:

| Method | Purpose |
|--------|---------|
| `session/update` | Session progress notification (message chunks, tool calls, plans) |
| `session/request_permission` | Ask user to approve a tool call |
| `fs/read_text_file` | Read a file from client's filesystem |
| `fs/write_text_file` | Write a file to client's filesystem |
| `terminal/create` | Create a terminal to run a command |
| `terminal/output` | Get terminal output |
| `terminal/wait_for_exit` | Wait for terminal command to complete |
| `terminal/kill` | Kill terminal command |
| `terminal/release` | Free terminal resources |
| `elicitation/create` | Request user input (UNSTABLE) |
| `elicitation/complete` | URL elicitation complete notification (UNSTABLE) |

### Tool Call Message Schema

**Tool calls are NOT requests from agent to client.** They are **notification payloads** inside `session/update`:

```typescript
// Creating a tool call (agent → client notification)
sessionUpdate({
  sessionId: "...",
  update: {
    sessionUpdate: "tool_call",     // discriminator
    toolCallId: "call_1",           // unique ID
    title: "Reading project files", // human-readable
    kind: "read",                   // "read"|"edit"|"delete"|"move"|"search"|"execute"|"think"|"fetch"
    status: "pending",              // "pending"|"in_progress"|"completed"|"failed"
    locations: [{ path: "/project/README.md" }],
    rawInput: { path: "/project/README.md" },
    content: [/* ToolCallContent */],
  },
});

// Updating a tool call
sessionUpdate({
  sessionId: "...",
  update: {
    sessionUpdate: "tool_call_update",
    toolCallId: "call_1",
    status: "completed",
    content: [{ type: "content", content: { type: "text", text: "..." } }],
    rawOutput: { ... },
  },
});
```

**`ToolCallContent`** is a discriminated union:
- `{ type: "content", content: Content }` — text, image, audio, embedded resource
- `{ type: "diff", ...Diff }` — file diff
- `{ type: "terminal", ...Terminal }` — terminal output reference

### Permission Flow

When the agent wants to execute a sensitive tool, it sends a `session/request_permission` **request** (not notification — it blocks waiting for a response):

```typescript
// Agent side (AgentSideConnection)
const response = await this.connection.requestPermission({
  sessionId: "...",
  toolCall: { toolCallId: "call_2", title: "Modifying config", kind: "edit", status: "pending", ... },
  options: [
    { kind: "allow_once", name: "Allow this change", optionId: "allow" },
    { kind: "reject_once", name: "Skip this change", optionId: "reject" },
  ],
});
// response.outcome.outcome === "selected" | "cancelled"
// response.outcome.optionId === "allow" | "reject"
```

### Extension Methods

Both sides support arbitrary extension methods/notifications:

```typescript
// Agent or Client interface
extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
extNotification?(method: string, params: Record<string, unknown>): Promise<void>;

// Usage from AgentSideConnection (agent calling client extension)
await conn.extMethod("example.com/ping", { data: "test" });
await conn.extNotification("example.com/notify", { info: "..." });

// Usage from ClientSideConnection (client calling agent extension)
await conn.extMethod("example.com/echo", { message: "hello" });
```

This is the **only** extensibility mechanism for custom tool-like interactions.

### Transport

**Only one transport: NDJSON over stdio.**

```typescript
// Stream type
type Stream = {
  writable: WritableStream<AnyMessage>;
  readable: ReadableStream<AnyMessage>;
};

// Create from stdio byte streams
function ndJsonStream(
  output: WritableStream<Uint8Array>,
  input: ReadableStream<Uint8Array>,
): Stream;
```

Alternatively, you can construct a `Stream` directly from `ReadableStream<AnyMessage>` / `WritableStream<AnyMessage>` — the connections accept raw `Stream` objects (tests use `TransformStream` for in-memory piping).

### Client Interface (what ghui must implement)

```typescript
interface Client {
  // REQUIRED
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  sessionUpdate(params: SessionNotification): Promise<void>;
  
  // OPTIONAL capabilities
  writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  releaseTerminal?(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse | void>;
  waitForTerminalExit?(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal?(params: KillTerminalRequest): Promise<KillTerminalResponse | void>;
  unstable_createElicitation?(params: CreateElicitationRequest): Promise<CreateElicitationResponse>;
  unstable_completeElicitation?(params: CompleteElicitationNotification): Promise<void>;
  extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
  extNotification?(method: string, params: Record<string, unknown>): Promise<void>;
}
```

### Agent Interface (what ghui calls through ClientSideConnection)

```typescript
interface Agent {
  // REQUIRED
  initialize(params: InitializeRequest): Promise<InitializeResponse>;
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse | void>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  
  // OPTIONAL
  loadSession?(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  listSessions?(params: ListSessionsRequest): Promise<ListSessionsResponse>;
  resumeSession?(params: ResumeSessionRequest): Promise<ResumeSessionResponse>;
  closeSession?(params: CloseSessionRequest): Promise<CloseSessionResponse | void>;
  setSessionMode?(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void>;
  setSessionConfigOption?(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse>;
  unstable_forkSession?(params: ForkSessionRequest): Promise<ForkSessionResponse>;
  unstable_setSessionModel?(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void>;
  unstable_listProviders?(params: ListProvidersRequest): Promise<ListProvidersResponse>;
  unstable_setProvider?(params: SetProvidersRequest): Promise<SetProvidersResponse | void>;
  unstable_disableProvider?(params: DisableProvidersRequest): Promise<DisableProvidersResponse | void>;
  unstable_logout?(params: LogoutRequest): Promise<LogoutResponse | void>;
  // + NES methods, document event handlers, extMethod, extNotification
}
```

### MCP Servers in Sessions

The client passes MCP server configurations when creating a session. The **agent** connects to those MCP servers — the client doesn't run them:

```typescript
await connection.newSession({
  cwd: process.cwd(),
  mcpServers: [
    // Stdio transport
    { type: "stdio", name: "my-tools", command: "node", args: ["mcp-server.js"], env: {} },
    // HTTP transport
    { type: "http", name: "remote-tools", url: "https://...", headers: [] },
    // SSE transport
    { type: "sse", name: "sse-tools", url: "https://...", headers: [] },
  ],
});
```

### Client-Side Connection Setup (Example from `examples/client.ts`)

```typescript
const agentProcess = spawn("npx", ["tsx", agentPath], { stdio: ["pipe", "pipe", "inherit"] });
const input = Writable.toWeb(agentProcess.stdin!);
const output = Readable.toWeb(agentProcess.stdout!) as ReadableStream<Uint8Array>;
const stream = acp.ndJsonStream(input, output);
const connection = new acp.ClientSideConnection((_agent) => new MyClient(), stream);

// Initialize
await connection.initialize({ protocolVersion: acp.PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } });
// Create session
const session = await connection.newSession({ cwd: process.cwd(), mcpServers: [] });
// Send prompt (blocks until agent completes turn)
const result = await connection.prompt({ sessionId: session.sessionId, prompt: [{ type: "text", text: "Hello!" }] });
```

## Key Finding: No Client-Side Tool Registration

**ACP does NOT support the client exposing custom tools to the agent.** The protocol provides:

1. **Fixed capabilities** the client can advertise: `fs.readTextFile`, `fs.writeTextFile`, `terminal` — these are the only "tools" the client exposes.
2. **Extension methods** (`extMethod`/`extNotification`) — arbitrary JSON-RPC methods prefixed with a domain name. This is the closest thing to custom tool registration, but it's ad-hoc and bilateral.
3. **MCP servers** — the client tells the agent about MCP servers to connect to. If ghui wants to expose tools, it could run an MCP server that the agent connects to.

### Options for ghui to receive tool calls from an agent:

1. **Implement the `Client` interface** — handle `sessionUpdate` notifications containing `tool_call`/`tool_call_update` and handle `requestPermission` requests. This is display/approve/reject only.
2. **Run an MCP server** that the agent connects to — pass it via `mcpServers` in `newSession`. The agent would then call MCP tools, which execute in ghui's process.
3. **Use extension methods** — implement `extMethod` on the Client to handle custom agent-initiated requests.

## Summary

The ACP TypeScript SDK (`@agentclientprotocol/sdk`) is a JSON-RPC 2.0 protocol over NDJSON stdio with two connection classes: `ClientSideConnection` (for editors/clients like ghui) and `AgentSideConnection` (for agents like Claude Code). The protocol has a clear asymmetry: agents own tools and report their execution to clients via `session/update` notifications; clients provide filesystem access, terminal execution, and permission gating. There is **no client-side tool registration mechanism** in the protocol. The closest alternatives are: (a) running an MCP server and passing it via `newSession.mcpServers`, (b) using `extMethod`/`extNotification` for ad-hoc bilateral RPCs, or (c) handling the built-in capabilities (fs, terminal, elicitation). For ghui's use case of receiving tool calls from an agent, the primary integration point is implementing the `Client` interface to handle `sessionUpdate` (to display tool calls) and `requestPermission` (to approve/reject them).
