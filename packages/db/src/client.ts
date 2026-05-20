import { mkdirSync } from "node:fs";
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

const PRAGMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -64000;
  PRAGMA busy_timeout = 5000;
`;

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
 * Returns a `YapprDb` with four typed repositories. Both CLI and desktop
 * consume the same surface — desktop forwards calls over Electrobun RPC.
 */
export function createDb(options: CreateDbOptions): YapprDb {
  if (options.path !== ":memory:") {
    mkdirSync(path.dirname(options.path), { recursive: true });
  }
  const sqlite = new Database(options.path, { create: true });
  sqlite.exec(PRAGMA_SQL);
  const db = drizzle(sqlite, { schema });
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
