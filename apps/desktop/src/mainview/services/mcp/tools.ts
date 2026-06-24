import { type SchemaInput, type Tool, toolDefinition } from "@tanstack/ai";
import { queryOptions } from "@tanstack/react-query";
import type { McpToolMeta } from "@yappr/sdk/mcp-rpc";

import { dbRpc } from "~/lib/db-rpc";

/**
 * MCP tools for the desktop agent loop (ADR 0002). Tool *metadata* is fetched
 * once over RPC; each tool's `.server()` callback round-trips execution to the
 * bun-side `McpManager` via `mcp:callTool`. The `@tanstack/ai` agent loop runs
 * in the webview exactly as before — only execution crosses to bun.
 */

/** Available MCP tools, connecting the bun-side manager lazily on first read. */
export const mcpToolsOptions = queryOptions({
  queryKey: ["mcp", "tools"] as const,
  queryFn: () => dbRpc.request("mcp:listTools"),
  // Tool roster rarely changes within a run; refetch is cheap but pointless.
  staleTime: Number.POSITIVE_INFINITY,
});

/** Build `@tanstack/ai` tools whose execution is bridged to bun over RPC. */
export function buildMcpTools(
  metas: McpToolMeta[],
): Array<Tool<SchemaInput, SchemaInput>> {
  return metas.map((meta) => {
    const def = toolDefinition({
      name: meta.name,
      description: meta.description ?? "",
      inputSchema: meta.inputSchema as SchemaInput,
    });
    return def.server(async (args: unknown) => {
      const result = await dbRpc.request("mcp:callTool", {
        name: meta.name,
        args: (args ?? {}) as Record<string, unknown>,
      });
      return result.content;
    });
  });
}
