import { type YapprDb } from "@yappr/db";
import type { DbRpcSchema } from "@yappr/db/rpc-types";

type Requests = DbRpcSchema["bun"]["requests"];
type Handlers = {
  [K in keyof Requests]: (
    params: Requests[K]["params"],
  ) => Requests[K]["response"] | Promise<Requests[K]["response"]>;
};

/**
 * Bun-side handlers for the desktop's webview ↔ bun RPC channel. Each method
 * is a thin pass-through to the typed repositories on `db`. Errors bubble as
 * rejected promises; Electrobun's RPC layer serialises them back to the
 * webview where TanStack Query turns them into `isError` state.
 *
 * The wire schema in `@yappr/db/rpc-types` is the contract — adding a method
 * here without updating the schema is a TS error on both sides.
 */
export function makeDbRpcHandlers(db: YapprDb): Handlers {
  return {
    "preferences:getAll": () => db.preferences.getAll(),
    "preferences:setMany": (entries) => {
      db.preferences.setMany(entries);
    },

    "conversations:list": () => db.conversations.list(),
    "conversations:get": ({ id }) => db.conversations.get(id),
    "conversations:create": ({ title, model }) =>
      db.conversations.create({ title, model }),
    "conversations:rename": ({ id, title }) => {
      db.conversations.rename(id, title);
    },
    "conversations:delete": ({ id }) => {
      db.conversations.delete(id);
    },

    "messages:list": ({ conversationId }) => db.messages.list(conversationId),
    "messages:append": ({ conversationId, role, content }) =>
      db.messages.append({ conversationId, role, content }),
    "messages:delete": ({ id }) => {
      db.messages.delete(id);
    },
  };
}
