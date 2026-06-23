import type { YapprDb } from "@yappr/db";
import {
  AgentEventsAppendInput,
  AgentEventsListForConversationInput,
  AgentEventsListForRunInput,
  ConversationsCreateInput,
  ConversationsDeleteInput,
  ConversationsGetInput,
  ConversationsListInput,
  ConversationsRenameInput,
  ConversationsSetArchivedInput,
  type DbRpcSchema,
  MessagesAppendInput,
  MessagesDeleteInput,
  MessagesListInput,
  PreferencesSetManyInput,
} from "@yappr/db/rpc";

type Requests = DbRpcSchema["bun"]["requests"];
type Handlers = {
  [K in keyof Requests]: (
    params: Requests[K]["params"],
  ) => Requests[K]["response"] | Promise<Requests[K]["response"]>;
};

/**
 * Bun-side handlers for the desktop's webview ↔ bun RPC channel. Each method
 * runs the matching zod input schema before touching the DB — a buggy or
 * malicious webview can't push malformed rows into SQLite.
 *
 * The wire schema in `@yappr/db/rpc` is the contract — adding a method here
 * without updating the schema is a TS error on both sides.
 */
export function makeDbRpcHandlers(db: YapprDb): Handlers {
  return {
    "preferences:getAll": () => db.preferences.getAll(),
    "preferences:setMany": (entries) => {
      db.preferences.setMany(PreferencesSetManyInput.parse(entries));
    },
    "conversations:list": (params) => {
      const parsed = ConversationsListInput.parse(params);
      const scope = parsed?.scope ?? "active";
      return db.conversations.list(scope, { limit: parsed?.limit });
    },
    "conversations:get": (params) => {
      const { id } = ConversationsGetInput.parse(params);
      return db.conversations.get(id);
    },
    "conversations:create": (params) => {
      const input = ConversationsCreateInput.parse(params);
      return db.conversations.create(input);
    },
    "conversations:rename": (params) => {
      const { id, title } = ConversationsRenameInput.parse(params);
      db.conversations.rename(id, title);
    },
    "conversations:delete": (params) => {
      const { id } = ConversationsDeleteInput.parse(params);
      db.conversations.delete(id);
    },
    "conversations:setArchived": (params) => {
      const { id, archived } = ConversationsSetArchivedInput.parse(params);
      db.conversations.setArchived(id, archived);
    },
    "messages:list": (params) => {
      const { conversationId, limit } = MessagesListInput.parse(params);
      return db.messages.list(conversationId, { limit });
    },
    "messages:append": (params) => {
      const input = MessagesAppendInput.parse(params);
      return db.messages.append(input);
    },
    "messages:delete": (params) => {
      const { id } = MessagesDeleteInput.parse(params);
      db.messages.delete(id);
    },
    "agentEvents:listForConversation": (params) => {
      const { conversationId, limit } =
        AgentEventsListForConversationInput.parse(params);
      return db.agentEvents.listForConversation(conversationId, {
        limit,
      });
    },
    "agentEvents:listForRun": (params) => {
      const { runId, limit } = AgentEventsListForRunInput.parse(params);
      return db.agentEvents.listForRun(runId, { limit });
    },
    "agentEvents:append": (params) => {
      const input = AgentEventsAppendInput.parse(params);
      return db.agentEvents.append(input);
    },
  };
}
