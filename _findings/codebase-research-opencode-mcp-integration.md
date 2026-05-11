# Codebase Research: opencode MCP Integration

## Research Question
How does MCP work in opencode? How to configure MCP servers (especially stdio/local), and how does the ACP session pass MCP servers to opencode?

## Search Trail

| # | Search Query / Pattern | Files Found | Notes |
|---|------------------------|-------------|-------|
| 1 | `grep "mcp"` in *.ts | 887 | Broad scan |
| 2 | `grep "mcpServer"` | 49 | ACP session creation and agent code |
| 3 | `grep "McpServer"` in *.ts | 5 | Type imported from `@agentclientprotocol/sdk` |
| 4 | `glob packages/opencode/src/mcp/**/*.ts` | 4 files | Core MCP module |

## Relevant Files

| # | File Path | Relevance | Key Lines |
|---|-----------|-----------|-----------|
| 1 | `packages/opencode/src/config/mcp.ts` | **Config schema** for MCP servers (Local + Remote types) | L1-65 |
| 2 | `packages/opencode/src/mcp/index.ts` | **Core MCP service** — connects to servers, manages lifecycle | L1-969 |
| 3 | `packages/opencode/src/acp/agent.ts` | **ACP agent** — converts ACP McpServer params to ConfigMCP.Info and calls `sdk.mcp.add()` | L1148-1186, L559-592 |
| 4 | `packages/opencode/src/acp/types.ts` | ACP session state type with `mcpServers: McpServer[]` | L1-24 |
| 5 | `packages/opencode/src/acp/session.ts` | Session manager — stores mcpServers in session state | L1-122 |
| 6 | `packages/opencode/src/skill/prompt/customize-opencode.md` | Documentation of config format including MCP examples | L73-85 |

## Code Path Map

### Entry Point: ACP `newSession()` (`packages/opencode/src/acp/agent.ts:L559`)

1. `newSession(params)` receives `params.mcpServers: McpServer[]` from the ACP client
2. Calls `sessionManager.create(cwd, mcpServers)` at L565 → stores session state
3. Calls `loadSessionMode({cwd, mcpServers, sessionId})` at L570
4. Inside `loadSessionMode` (not fully traced but calls `this.loadMcpServers()` equivalent), the mcpServers are converted at **L1148-1168**:
   - For each `McpServer`, checks if it has `type` property (remote) or not (local/stdio)
   - **Remote**: `{ type: "remote", url, headers }` — converts header array to record
   - **Local/stdio**: `{ type: "local", command: [command, ...args], environment: {...} }` — converts env array to record
5. Each converted server is added via `this.sdk.mcp.add({directory, name, config})` at L1172-1186

### Entry Point: Config-based MCP init (`packages/opencode/src/mcp/index.ts:L524-587`)

1. `InstanceState.make()` reads `cfg.mcp` from opencode config
2. Iterates `Object.entries(config)` and calls `create(key, mcp)` for each
3. `create()` at L458 dispatches on `mcp.type`:
   - **`"remote"`** → `connectRemote()` at L307 — tries StreamableHTTP then SSE transports, with OAuth support
   - **`"local"`** → `connectLocal()` at L423 — uses **`StdioClientTransport`** from `@modelcontextprotocol/sdk/client/stdio.js`

### Local/stdio MCP connection (`packages/opencode/src/mcp/index.ts:L423-456`)

```typescript
const connectLocal = function* (key, mcp) {
  const [cmd, ...args] = mcp.command
  const transport = new StdioClientTransport({
    stderr: "pipe",
    command: cmd,
    args,
    cwd,
    env: { ...process.env, ...mcp.environment },
  })
  // connects via connectTransport()
}
```

## Config Format

### opencode.json MCP config (`packages/opencode/src/config/mcp.ts`)

```jsonc
{
  "mcp": {
    "my-local-server": {
      "type": "local",
      "command": ["node", "path/to/server.js"],  // array: [cmd, ...args]
      "environment": { "KEY": "value" },          // optional env vars
      "enabled": true,                            // optional, default true
      "timeout": 30000                            // optional, default 30s
    },
    "my-remote-server": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ..." },
      "oauth": false,                             // or OAuth config object
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

### ACP McpServer format (passed to `newSession`)

The ACP SDK defines `McpServer` — couldn't inspect directly (not installed in worktree), but from agent.ts L1148-1168 we can infer:

**Local/stdio server** (no `type` property):
```typescript
{
  name: string
  command: string
  args: string[]
  env: Array<{ name: string; value: string }>
}
```

**Remote server** (has `type` property):
```typescript
{
  name: string
  type: string  // presence distinguishes from local
  url: string
  headers: Array<{ name: string; value: string }>
}
```

## Key Answers

### 1. Does opencode support stdio MCP servers?
**Yes, fully.** Local MCP servers use `StdioClientTransport` from the official `@modelcontextprotocol/sdk`. The server process is spawned as a child process communicating over stdin/stdout. Set `type: "local"` in config.

### 2. How to configure an MCP server for opencode ACP sessions?
Two ways:
- **Static config**: Add to `opencode.json` under the `mcp` key (see format above)
- **Dynamic via ACP**: Pass `mcpServers` array in `newSession()` call — opencode converts these and calls `sdk.mcp.add()` internally

### 3. For ghui exposing a custom tool via MCP:
ghui would need to either:
- **Run a local MCP server** that opencode connects to via stdio (spawn a subprocess)
- **Pass it as an `mcpServer` in the ACP `newSession()` params** — this is the programmatic path

The ACP `newSession` params accept an array of `McpServer` objects. For a local/stdio server, provide `{ name, command, args, env }`.

### 4. Config note on `command` field
**Important**: `mcp[name].command` in `opencode.json` is an **array of strings** (`["npx", "-y", "@playwright/mcp"]`), never a single string. The first element is the executable, rest are args. This differs from ACP's format where `command` and `args` are separate.

## Architectural Context
- **Module**: `packages/opencode/src/mcp/` — Effect-based service with lifecycle management
- **Dependencies**: `@modelcontextprotocol/sdk` (official MCP SDK), Effect framework, opencode config system
- **Transport types**: StdioClientTransport (local), StreamableHTTPClientTransport (remote), SSEClientTransport (remote fallback)
- **Related Tests**: `packages/opencode/test/mcp/lifecycle.test.ts`, `packages/opencode/test/server/httpapi-mcp.test.ts`

## Summary

opencode has full stdio MCP server support via `type: "local"` config. Servers are spawned as child processes using `StdioClientTransport`. For ghui integration, the most direct path is passing MCP servers in the ACP `newSession()` call's `mcpServers` parameter — opencode will convert these to its internal `ConfigMCP.Info` format and call `sdk.mcp.add()`. The config format requires `command` as a string array and optionally `environment`, `enabled`, and `timeout`.
