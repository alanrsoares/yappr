import { Electroview } from "electrobun/view";

import type { AppRpcSchema } from "../../rpc-schema";

/**
 * Typed webview-side client for the bun ↔ webview RPC channel: the
 * `~/.yappr/yappr.db` persistence layer plus the MCP tool bridge (ADR 0002).
 * All access from React goes through `dbRpc.request("domain:verb", ...)`,
 * forwarded over Electrobun's websocket transport to the bun-side handlers.
 *
 * Importing this module has a side-effect: it instantiates `Electroview`,
 * which opens the RPC socket. The module-singleton pattern matches Electrobun's
 * own examples — one Electroview per webview lifetime.
 */
const rpc = Electroview.defineRPC<AppRpcSchema>({
  handlers: { requests: {} },
});

// Side-effect: opens the bun ↔ webview socket. Held onto via export so the
// instance isn't garbage-collected.
export const electroview = new Electroview({ rpc });

export const dbRpc = rpc;
