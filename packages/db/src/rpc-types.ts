/**
 * Wire-format type contract for the desktop's bun ↔ webview RPC channel.
 *
 * Types-only file — no runtime imports (drizzle, bun:sqlite) leak into the
 * browser bundle. Both sides import this same module: bun-side as the
 * authoritative handler shape, webview-side as the client typings.
 *
 * Row shapes mirror `schema.ts` but are re-declared here so the webview never
 * pulls in drizzle-orm just for `$inferSelect`. Keep in sync if columns
 * change — the bun-side handler returns the drizzle row directly, so a TS
 * mismatch will surface at the handler boundary.
 */

export type Role = "user" | "assistant" | "system";

export interface ConversationRow {
  id: string;
  title: string;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
}

/**
 * Electrobun RPC schema. `bun.requests` lists every method the webview can
 * call; webview-side has no requests of its own (one-way data flow into the
 * persistence layer). Method names use a `domain:verb` convention so adding
 * future surfaces (e.g. `mcp:*`) doesn't collide.
 */
export interface DbRpcSchema {
  bun: {
    requests: {
      "preferences:getAll": {
        params: undefined;
        response: Record<string, unknown>;
      };
      "preferences:setMany": {
        params: Record<string, unknown>;
        response: void;
      };

      "conversations:list": {
        params: undefined;
        response: ConversationRow[];
      };
      "conversations:get": {
        params: { id: string };
        response: ConversationRow | null;
      };
      "conversations:create": {
        params: { title: string; model?: string };
        response: ConversationRow;
      };
      "conversations:rename": {
        params: { id: string; title: string };
        response: void;
      };
      "conversations:delete": {
        params: { id: string };
        response: void;
      };

      "messages:list": {
        params: { conversationId: string };
        response: MessageRow[];
      };
      "messages:append": {
        params: {
          conversationId: string;
          role: Role;
          content: string;
        };
        response: MessageRow;
      };
      "messages:delete": {
        params: { id: string };
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
