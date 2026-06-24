import type { DbRpcSchema } from "@yappr/db/rpc";
import type { McpRpcMethods } from "@yappr/sdk/mcp-rpc";

/**
 * The desktop's full Electrobun wire contract: the DB persistence methods
 * (`@yappr/db/rpc`) plus the MCP tool-execution bridge (`@yappr/sdk/mcp-rpc`,
 * ADR 0002). Types only — imported by both the bun side and the webview, so it
 * stays free of runtime coupling across the Electrobun boundary.
 */
export interface AppRpcSchema {
  bun: {
    requests: DbRpcSchema["bun"]["requests"] & McpRpcMethods;
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
}
