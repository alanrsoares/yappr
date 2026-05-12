import type { DbRpcSchema } from "@yappr/db/rpc";
import { Electroview } from "electrobun/view";

/**
 * Typed webview-side client for the `~/.yappr/yappr.db` persistence layer.
 * All DB access from React goes through `dbRpc.request("domain:verb", ...)`,
 * which is forwarded over Electrobun's websocket transport to the bun-side
 * handlers in `bun/db-rpc.ts`.
 *
 * Importing this module has a side-effect: it instantiates `Electroview`,
 * which opens the RPC socket. The module-singleton pattern matches Electrobun's
 * own examples — one Electroview per webview lifetime.
 */
const rpc = Electroview.defineRPC<DbRpcSchema>({
  handlers: { requests: {} },
});

// Side-effect: opens the bun ↔ webview socket. Held onto via export so the
// instance isn't garbage-collected.
export const electroview = new Electroview({ rpc });

export const dbRpc = rpc;
