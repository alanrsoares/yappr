import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import {
  makeAgentEventsRepo,
  type AgentEventsRepo,
} from "./repositories/agent-events.js";
import {
  makeConversationsRepo,
  type ConversationsRepo,
} from "./repositories/conversations.js";
import {
  makeMessagesRepo,
  type MessagesRepo,
} from "./repositories/messages.js";
import {
  makePreferencesRepo,
  type PreferencesRepo,
} from "./repositories/preferences.js";
import * as schema from "./schema.js";

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsFolder = path.join(packageDir, "drizzle");
const initialMigrationTag = "0000_known_whizzer";
const initialMigrationFile = path.join(
  migrationsFolder,
  `${initialMigrationTag}.sql`,
);
const journalFile = path.join(migrationsFolder, "meta", "_journal.json");

interface DrizzleJournalEntry {
  idx: number;
  tag: string;
  when: number;
}

function readJournalWhen(tag: string): number {
  try {
    const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
      entries: DrizzleJournalEntry[];
    };
    return journal.entries.find((e) => e.tag === tag)?.when ?? 0;
  } catch {
    return 0;
  }
}

const PRAGMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -64000;
  PRAGMA busy_timeout = 5000;
`;

function tableExists(sqlite: Database, table: string): boolean {
  const row = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(table);
  return row !== null;
}

function tableHasColumn(
  sqlite: Database,
  table: string,
  column: string,
): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return rows.some((r) => r.name === column);
}

function hasLegacyAppSchema(sqlite: Database): boolean {
  return ["preferences", "conversations", "messages", "agent_events"].some(
    (table) => tableExists(sqlite, table),
  );
}

function ensureLegacyBaselineSchema(sqlite: Database): void {
  sqlite.exec(`
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

    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      event_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_messages_conv_created
      ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_events_conv_created
      ON agent_events(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_events_run_created
      ON agent_events(run_id, created_at);
  `);

  if (!tableHasColumn(sqlite, "conversations", "archived")) {
    sqlite.exec(
      "ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    );
    sqlite.exec("UPDATE conversations SET archived = 0");
  }
  if (!tableHasColumn(sqlite, "messages", "parts_json")) {
    sqlite.exec("ALTER TABLE messages ADD COLUMN parts_json TEXT");
  }
}

function baselineLegacyDrizzleMigration(sqlite: Database): void {
  if (
    tableExists(sqlite, "__drizzle_migrations") ||
    !hasLegacyAppSchema(sqlite)
  )
    return;

  ensureLegacyBaselineSchema(sqlite);
  const migrationSql = readFileSync(initialMigrationFile, "utf8");
  const hash = createHash("sha256").update(migrationSql).digest("hex");
  // `created_at` must match the migration's journal `when` so drizzle's
  // `entry.when > lastCreatedAt` comparison applies future migrations.
  // Using `Date.now()` here would silently skip any migration whose
  // generation timestamp is older than the baseline-insertion clock.
  const createdAt = readJournalWhen(initialMigrationTag);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
  `);
  sqlite
    .prepare(
      'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
    )
    .run(hash, createdAt);
}

export interface YapprDb {
  readonly raw: Database;
  readonly drizzle: BunSQLiteDatabase<typeof schema>;
  readonly preferences: PreferencesRepo;
  readonly conversations: ConversationsRepo;
  readonly messages: MessagesRepo;
  readonly agentEvents: AgentEventsRepo;
  close(): void;
}

export interface CreateDbOptions {
  /** Absolute file path (e.g. `~/.yappr/yappr.db`) or `":memory:"` for tests. */
  path: string;
}

/**
 * Open (or create) the Yappr SQLite database at `options.path`. Idempotent:
 * applies Drizzle migrations on every open so schema changes are tracked in
 * `__drizzle_migrations`. Parent directory is auto-created.
 *
 * Returns a `YapprDb` with three typed repositories. Both CLI and desktop
 * consume the same surface — desktop forwards calls over Electrobun RPC.
 */
export function createDb(options: CreateDbOptions): YapprDb {
  if (options.path !== ":memory:") {
    mkdirSync(path.dirname(options.path), { recursive: true });
  }
  const sqlite = new Database(options.path, { create: true });
  sqlite.exec(PRAGMA_SQL);
  const db = drizzle(sqlite, { schema });
  baselineLegacyDrizzleMigration(sqlite);
  migrate(db, { migrationsFolder });

  return {
    raw: sqlite,
    drizzle: db,
    preferences: makePreferencesRepo(db),
    conversations: makeConversationsRepo(db),
    messages: makeMessagesRepo(db),
    agentEvents: makeAgentEventsRepo(db),
    close: () => sqlite.close(),
  };
}
