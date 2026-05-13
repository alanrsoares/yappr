import { mkdirSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

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
import { INIT_SQL, SCHEMA_VERSION, SCHEMA_VERSION_KEY } from "./schema.js";

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

export interface YapprDb {
  readonly raw: Database;
  readonly drizzle: BunSQLiteDatabase<typeof schema>;
  readonly preferences: PreferencesRepo;
  readonly conversations: ConversationsRepo;
  readonly messages: MessagesRepo;
  close(): void;
}

export interface CreateDbOptions {
  /** Absolute file path (e.g. `~/.yappr/yappr.db`) or `":memory:"` for tests. */
  path: string;
}

/**
 * Open (or create) the Yappr SQLite database at `options.path`. Idempotent:
 * runs `INIT_SQL` on every open so `CREATE TABLE IF NOT EXISTS` keeps the
 * schema current. Parent directory is auto-created.
 *
 * Returns a `YapprDb` with three typed repositories. Both CLI and desktop
 * consume the same surface — desktop forwards calls over Electrobun RPC.
 */
export function createDb(options: CreateDbOptions): YapprDb {
  if (options.path !== ":memory:") {
    mkdirSync(path.dirname(options.path), { recursive: true });
  }
  const sqlite = new Database(options.path, { create: true });
  sqlite.exec(INIT_SQL);
  const db = drizzle(sqlite, { schema });

  const preferences = makePreferencesRepo(db);
  // Never gate ADD COLUMN on `_schema_version` alone: a partially-opened DB can
  // record v2 before `archived` exists. Always repair schema from actual PRAGMA.
  let addedArchivedColumn = false;
  if (!tableHasColumn(sqlite, "conversations", "archived")) {
    sqlite.exec(
      "ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    );
    addedArchivedColumn = true;
  }
  // Backfill pre-existing rows after ALTER (some SQLite builds rely on this).
  if (addedArchivedColumn) {
    sqlite.exec("UPDATE conversations SET archived = 0");
  }

  if (!tableHasColumn(sqlite, "messages", "parts_json")) {
    sqlite.exec("ALTER TABLE messages ADD COLUMN parts_json TEXT");
  }

  preferences.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION);

  return {
    raw: sqlite,
    drizzle: db,
    preferences,
    conversations: makeConversationsRepo(db),
    messages: makeMessagesRepo(db),
    close: () => sqlite.close(),
  };
}
