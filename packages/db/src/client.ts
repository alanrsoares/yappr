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
  // Record the schema version so future ALTER ladders can branch on the
  // previously-applied value. Safe to overwrite on every open — version only
  // increments when a real migration lands.
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
