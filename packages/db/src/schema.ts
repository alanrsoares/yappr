import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Yappr SQLite schema. Schema-first per the project directive — Drizzle
 * tables here are the source of truth; TS types are inferred via
 * `typeof X.$inferSelect` / `$inferInsert`.
 *
 * Performance + integrity choices (SQLite / libsql best practices):
 *   - `STRICT` tables: SQLite enforces column types instead of treating types
 *     as advisory ("type affinity"). Catches silent coercion bugs early.
 *   - `WAL` journal + `synchronous = NORMAL`: safe with WAL, ~2x writes vs
 *     `FULL`. `busy_timeout = 5000` keeps concurrent reads/writes patient.
 *   - `temp_store = MEMORY`, `cache_size = -64000` (~64 MB): cheap, app is
 *     local-only so memory budget is generous.
 *   - Composite index `(conversation_id, created_at)` on `messages` covers
 *     both "list messages for conversation" and the chronological ordering
 *     in a single index — no separate single-column indexes needed.
 *   - `_schema_version` row in `preferences` lets future ALTER ladders gate
 *     themselves on the previously-applied version.
 *
 * Storage layout:
 *   - `preferences` is a KV table: each app (CLI, desktop) owns its keys via
 *     its own zod schema. Shared keys (voice, speed, serverUrl) read/write
 *     the same row so the two surfaces stay in sync.
 *   - `conversations` + `messages` are relational; messages cascade-delete
 *     with the conversation. Timestamps are unix-ms ints for portability.
 */

export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON-encoded; parsed at the repository edge
  updatedAt: integer("updated_at").notNull(),
});

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    model: text("model"),
    /** 0 = visible in main sidebar, 1 = archived only. Plain integers avoid SQLite boolean-mapping quirks in WHERE clauses. */
    archived: integer("archived").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check("conversations_archived_check", sql`${table.archived} IN (0, 1)`),
    index("idx_conversations_updated").on(table.updatedAt),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    /** JSON array of AI SDK UI parts (`text` + `file`) for multimodal user turns; null = legacy text-only. */
    partsJson: text("parts_json"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    check(
      "messages_role_check",
      sql`${table.role} IN ('user', 'assistant', 'system')`,
    ),
    index("idx_messages_conv_created").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const agentEvents = sqliteTable(
  "agent_events",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    runId: text("run_id").notNull(),
    type: text("type").notNull(),
    eventJson: text("event_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_agent_events_conv_created").on(
      table.conversationId,
      table.createdAt,
    ),
    index("idx_agent_events_run_created").on(table.runId, table.createdAt),
  ],
);

export type Preference = typeof preferences.$inferSelect;
export type NewPreference = typeof preferences.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type AgentEvent = typeof agentEvents.$inferSelect;
export type NewAgentEvent = typeof agentEvents.$inferInsert;
