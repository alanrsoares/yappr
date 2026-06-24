import { z } from "zod";

/**
 * Wire contract for the desktop's MCP tool-execution bridge (ADR 0002).
 *
 * MCP servers run on the Electrobun bun side (processes can't live in the
 * webview). The webview's `@tanstack/ai` agent loop reaches them over the
 * existing request/response RPC: `mcp:listTools` for metadata at session start,
 * `mcp:callTool` for each tool invocation. Both sides import this module — bun
 * as the handler shape + input validator, webview as the client typings.
 */

/** A tool the model can call: name + description + raw JSON-Schema input. */
export const McpToolMetaSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** JSON Schema for the tool's arguments; passed straight to `@tanstack/ai`. */
  inputSchema: z.unknown(),
});
export type McpToolMeta = z.infer<typeof McpToolMetaSchema>;

export const McpCallToolInput = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
});
export type McpCallToolInput = z.infer<typeof McpCallToolInput>;

/** The `content` blocks of an MCP `CallToolResult` (text/image/resource/…). */
export interface McpCallToolResult {
  content: unknown;
}

/**
 * The `mcp:*` slice of the desktop's Electrobun `bun.requests`. Composed into
 * the app-wide schema alongside the DB methods (see desktop `rpc-schema.ts`).
 * A `type` (not `interface`) so it keeps the implicit string-index signature
 * Electrobun's `RPCSchema` constraint requires after intersection.
 */
export type McpRpcMethods = {
  "mcp:listTools": { params: undefined; response: McpToolMeta[] };
  "mcp:callTool": { params: McpCallToolInput; response: McpCallToolResult };
};
