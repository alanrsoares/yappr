import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  model: text("model"),
  /** 0 = visible in main sidebar, 1 = archived only. Plain integers avoid SQLite boolean-mapping quirks in WHERE clauses. */
  archived: integer("archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  /** JSON array of AI SDK UI parts (`text` + `file`) for multimodal user turns; null = legacy text-only. */
  partsJson: text("parts_json"),
  createdAt: integer("created_at").notNull(),
});

export type Preference = typeof preferences.$inferSelect;
export type NewPreference = typeof preferences.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const SCHEMA_VERSION = 3;
export const SCHEMA_VERSION_KEY = "_schema_version";

/**
 * Idempotent schema bootstrap. Runs on every `createDb()` — `CREATE TABLE IF
 * NOT EXISTS` makes it safe to re-run. The `STRICT` keyword is the SQLite
 * 3.37+ feature that turns type-affinity hints into hard column constraints.
 *
 * When the schema needs to evolve, add `ALTER TABLE` statements below this
 * block guarded on `_schema_version` reads (see migrate.ts when it lands).
 */
export const INIT_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -64000;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT,
    archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    parts_json TEXT,
    created_at INTEGER NOT NULL
  ) STRICT;

  -- Composite index covers both filter-by-conversation and the chronological
  -- ordering in one shot; avoids a separate index on conversation_id alone.
  CREATE INDEX IF NOT EXISTS idx_messages_conv_created
    ON messages(conversation_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_conversations_updated
    ON conversations(updated_at DESC);
`;
