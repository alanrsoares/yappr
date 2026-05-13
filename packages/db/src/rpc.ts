import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { conversations, messages } from "./schema.js";

/**
 * Wire-format zod schemas + TS contract for the desktop's bun ↔ webview RPC
 * channel. Both sides import this same module: bun-side as the handler shape
 * + runtime input validators, webview-side as the client typings.
 *
 * Row schemas (`ConversationSchema`, `MessageSchema`) come from `drizzle-zod`
 * so the Drizzle tables in `schema.ts` stay the single source of truth for
 * columns. Input schemas (e.g. `ConversationsRenameInput`) are hand-authored
 * zod because they aren't always row-shaped.
 *
 * The bun-side handler runs `.parse(...)` on every incoming payload before
 * touching the DB so a buggy/malicious webview can't push malformed rows
 * into SQLite.
 */

// ---- Row schemas (derived from Drizzle tables) ----------------------------

export const ConversationSchema = createSelectSchema(conversations);
export const MessageSchema = createSelectSchema(messages);

export type ConversationRow = z.infer<typeof ConversationSchema>;
export type MessageRow = z.infer<typeof MessageSchema>;

export const RoleSchema = z.enum(["user", "assistant", "system"]);
export type Role = z.infer<typeof RoleSchema>;

// ---- RPC input schemas ----------------------------------------------------

export const PreferencesSetManyInput = z.record(z.string(), z.unknown());

export const ConversationsGetInput = z.object({ id: z.string().min(1) });
export const ConversationsCreateInput = z.object({
  title: z.string().min(1),
  model: z.string().optional(),
});
export const ConversationsRenameInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export const ConversationsDeleteInput = z.object({ id: z.string().min(1) });

/** Omit or use `{ scope: "active" }` for the main sidebar; `"archived"` for the archived bucket. */
export const ConversationsListInput = z
  .object({
    scope: z.enum(["active", "archived", "all"]).optional(),
  })
  .optional();

export const ConversationsSetArchivedInput = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
});

export const MessagesListInput = z.object({
  conversationId: z.string().min(1),
});
export const MessagesAppendInput = z.object({
  conversationId: z.string().min(1),
  role: RoleSchema,
  content: z.string(),
  /** JSON-encoded `UIMessage["parts"]` subset (e.g. text + file); omit for plain text. */
  partsJson: z.string().max(12_000_000).optional(),
});
export const MessagesDeleteInput = z.object({ id: z.string().min(1) });

// ---- Wire contract (Electrobun RPC schema) --------------------------------

/**
 * `bun.requests` lists every method the webview can call. Method names use a
 * `domain:verb` convention so future surfaces (e.g. `mcp:*`) don't collide.
 * Webview-side has no requests of its own — data flow is one-way into the
 * persistence layer.
 */
export interface DbRpcSchema {
  bun: {
    requests: {
      "preferences:getAll": {
        params: undefined;
        response: Record<string, unknown>;
      };
      "preferences:setMany": {
        params: z.infer<typeof PreferencesSetManyInput>;
        response: void;
      };

      "conversations:list": {
        params: z.infer<typeof ConversationsListInput>;
        response: ConversationRow[];
      };
      "conversations:get": {
        params: z.infer<typeof ConversationsGetInput>;
        response: ConversationRow | null;
      };
      "conversations:create": {
        params: z.infer<typeof ConversationsCreateInput>;
        response: ConversationRow;
      };
      "conversations:rename": {
        params: z.infer<typeof ConversationsRenameInput>;
        response: void;
      };
      "conversations:delete": {
        params: z.infer<typeof ConversationsDeleteInput>;
        response: void;
      };
      "conversations:setArchived": {
        params: z.infer<typeof ConversationsSetArchivedInput>;
        response: void;
      };

      "messages:list": {
        params: z.infer<typeof MessagesListInput>;
        response: MessageRow[];
      };
      "messages:append": {
        params: z.infer<typeof MessagesAppendInput>;
        response: MessageRow;
      };
      "messages:delete": {
        params: z.infer<typeof MessagesDeleteInput>;
        response: void;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
}
