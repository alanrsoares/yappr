# 2. Desktop MCP tool-execution bridge

Date: 2026-06-24

## Status

Accepted

## Context

The CLI gained a bounded multi-step tool-use agent loop (#25 Ollama, #26
OpenRouter): `streamTanstackChat` runs `@tanstack/ai` with `getTanStackTools()`
and `agentLoopStrategy: maxIterations(8)`, executing MCP tools in-process via
`McpManager` (sdk, Effect-based).

The desktop has **none of this**. Its chat runs entirely in the **webview**:
`createOllamaConnection` calls `@tanstack/ai`'s `chat({ adapter, messages })`
directly, streaming from the local Ollama daemon over HTTP (Vite proxy in dev,
loopback in the packaged build), wired into React through `@tanstack/ai-react`'s
`useChat`. There are no `tools` and no `agentLoopStrategy`.

MCP servers are **processes** (stdio/HTTP transports, `McpManager` spawns/holds
clients). They cannot run in the webview. They must run on the Electrobun **bun
side** — the same process that already owns the SQLite handle and the typed RPC
channel (`bun/index.ts` → `makeDbRpcHandlers(db)` over `defineElectrobunRPC`).

The question is *where the agent loop runs* and *how a webview-resident loop
reaches bun-side tools*.

## Decision

**Tools execute over the existing request/response RPC; the agent loop stays in
the webview.**

1. **Bun side** hosts a single `McpManager`. A new RPC namespace exposes it:
   - `mcp:listTools` → tool metadata (`name`, `description`, JSON-Schema
     `inputSchema`) for every connected server.
   - `mcp:callTool` `{ name, args }` → the MCP `CallToolResult.content`.
   Both validate input with zod bun-side, same trust model as `db-rpc` (a buggy
   webview can only reach configured servers' tools). `McpManager` connects
   **lazily** on the first `mcp:listTools` (config via the sdk's
   `resolveMcpConfigPath()` — same cascade as the CLI) and is closed alongside
   `db` on window close.

2. **Webview**, at chat-session start, fetches metadata via `mcp:listTools` and
   builds `@tanstack/ai` tools whose `.server()` callback round-trips to bun:
   `toolDefinition({...}).server((args) => dbRpc.request("mcp:callTool", { name, args }))`.
   These tools + `agentLoopStrategy: maxIterations(8)` are passed into the
   existing `chat()` call. The loop runs in the webview exactly as today; only
   tool *execution* crosses to bun.

3. **Tool trace** renders from the `TOOL_CALL_START` / `TOOL_CALL_END` chunks
   the webview loop already emits — same pattern as the CLI's `onToolCall`,
   distinct from the answer text — and `tool.call` / `tool.result` events are
   **persisted to the shared agent-events table** (parity with the CLI) over RPC,
   so a tools-enabled conversation replays the same on either surface.

The RPC schema lives in a **new `@yappr/sdk` mcp-rpc module**, not `@yappr/db/rpc`
(which is DB-specific). Scope is **Ollama-only** for v1 — the desktop has no
OpenRouter transport yet.

## Consequences

- Smallest coherent change: reuses the existing request/response RPC (tool calls
  are discrete request→response — no streaming-RPC plumbing needed), leaves the
  webview `useChat` + Ollama streaming path untouched, and mirrors the CLI's
  `getTanStackTools().server(cb)` shape — only the callback body differs
  (in-process Effect → RPC call).
- MCP stays bun-side, its natural home (processes + config + SQLite neighbour).
- Tool args/results cross the boundary as JSON. MCP payloads are already JSON
  (`CallToolResult`, JSON-Schema inputs), so this is lossless; per-call
  round-trip latency is negligible against model + tool latency.
- Two chat engines persist (webview `chat()` for desktop, bun `streamTanstackChat`
  for CLI). They share `@tanstack/ai` but aren't unified. Accepted — unifying is
  a separate, larger concern (see Alternative B).
- Lazy connect means the first tools-enabled chat pays the MCP connect cost once
  per app run; a tool-less chat pays nothing.

## Alternatives considered

- **B. Move the whole chat loop to the bun side**, streaming `ChatStreamEvent`s
  to the webview over RPC (the CLI's `streamTanstackChat`, shared). Unifies CLI +
  desktop on one engine and keeps MCP entirely bun-side. **Rejected for now:**
  requires a *streaming* RPC channel (the current one is request/response),
  discards the `@tanstack/ai-react` `useChat` integration, and is a much larger
  refactor. The unification upside doesn't justify the plumbing for #24.
- **C. Static webview tools, no MCP.** Defeats the purpose — MCP servers are
  dynamic and process-based.

## Resolved decisions

1. **Connect timing** — lazy on first `mcp:listTools`.
2. **Config source** — the sdk's `resolveMcpConfigPath()` cascade, so desktop +
   CLI read the same servers.
3. **Trace persistence** — persist `tool.call` / `tool.result` to the shared
   agent-events table, matching the CLI.
