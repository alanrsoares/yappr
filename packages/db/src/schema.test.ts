import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { createDb } from "./client.js";

function tableNames(db: ReturnType<typeof createDb>) {
  return db.raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
}

function indexNames(db: ReturnType<typeof createDb>) {
  return db.raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
}

function strictTables(db: ReturnType<typeof createDb>) {
  return db.raw.prepare("PRAGMA table_list").all() as Array<{
    name: string;
    strict: number;
  }>;
}

function foreignKeys(db: ReturnType<typeof createDb>, table: string) {
  return db.raw.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{
    table: string;
    from: string;
    to: string;
    on_delete: string;
  }>;
}

describe("db schema", () => {
  test("applies drizzle migrations for core tables and indexes", () => {
    const db = createDb({ path: ":memory:" });

    expect(tableNames(db).map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "__drizzle_migrations",
        "agent_events",
        "conversations",
        "messages",
        "preferences",
      ]),
    );
    expect(indexNames(db).map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "idx_agent_events_conv_created",
        "idx_agent_events_run_created",
        "idx_conversations_updated",
        "idx_messages_conv_created",
      ]),
    );

    db.close();
  });

  test("keeps sqlite strict tables and cascade foreign keys", () => {
    const db = createDb({ path: ":memory:" });
    const strictByName = new Map(
      strictTables(db).map((row) => [row.name, row.strict]),
    );

    expect(strictByName.get("agent_events")).toBe(1);
    expect(strictByName.get("conversations")).toBe(1);
    expect(strictByName.get("messages")).toBe(1);
    expect(strictByName.get("preferences")).toBe(1);
    expect(foreignKeys(db, "messages")).toContainEqual(
      expect.objectContaining({
        table: "conversations",
        from: "conversation_id",
        to: "id",
        on_delete: "CASCADE",
      }),
    );
    expect(foreignKeys(db, "agent_events")).toContainEqual(
      expect.objectContaining({
        table: "conversations",
        from: "conversation_id",
        to: "id",
        on_delete: "CASCADE",
      }),
    );

    db.close();
  });

  test("baselines a legacy sqlite db into drizzle migrations", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "yappr-db-"));
    const dbPath = path.join(dir, "legacy.db");
    const legacy = new Database(dbPath, { create: true });
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      INSERT INTO preferences (key, value, updated_at)
        VALUES ('defaultVoice', '"af_heart"', 1);
    `);
    legacy.close();

    const db = createDb({ path: dbPath });

    expect(db.preferences.get<string>("defaultVoice")).toBe("af_heart");
    expect(tableNames(db).map((row) => row.name)).toEqual(
      expect.arrayContaining(["__drizzle_migrations", "agent_events"]),
    );
    expect(
      db.raw
        .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
        .get(),
    ).toEqual({ count: 1 });
    expect(
      db.raw
        .prepare("PRAGMA table_info(messages)")
        .all()
        .map((row) => (row as { name: string }).name),
    ).toContain("parts_json");
    expect(
      db.raw
        .prepare("PRAGMA table_info(conversations)")
        .all()
        .map((row) => (row as { name: string }).name),
    ).toContain("archived");

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
