import { McpManager } from "@yappr/sdk/mcp";
import {
  McpCallToolInput,
  type McpCallToolResult,
  type McpToolMeta,
} from "@yappr/sdk/mcp-rpc";
import { Effect } from "effect";

/**
 * Bun-side handlers for the desktop MCP tool-execution bridge (ADR 0002).
 *
 * MCP servers are processes, so the `McpManager` lives here (alongside the
 * SQLite handle), not in the webview. It connects **lazily** on the first
 * `mcp:listTools` — a session that never uses tools pays nothing — and the same
 * connection is reused for the app's lifetime. Config comes from the sdk's
 * `resolveMcpConfigPath()` cascade, so desktop + CLI see the same servers.
 */
export interface McpRpc {
  requests: {
    "mcp:listTools": () => Promise<McpToolMeta[]>;
    "mcp:callTool": (params: unknown) => Promise<McpCallToolResult>;
  };
  close: () => Promise<void>;
}

export function makeMcpRpcHandlers(): McpRpc {
  let manager: McpManager | null = null;
  let ready: Promise<McpManager> | null = null;

  const ensure = (): Promise<McpManager> => {
    if (!ready) {
      const mgr = new McpManager();
      manager = mgr;
      ready = Effect.runPromise(mgr.loadConfigAndGetStatuses()).then(() => mgr);
    }
    return ready;
  };

  return {
    requests: {
      "mcp:listTools": async () => (await ensure()).getToolMetadata(),
      "mcp:callTool": async (params) => {
        const { name, args } = McpCallToolInput.parse(params);
        const mgr = await ensure();
        const result = await Effect.runPromise(mgr.callTool(name, args));
        return { content: result.content };
      },
    },
    close: async () => {
      if (manager) await manager.close();
      manager = null;
      ready = null;
    },
  };
}
