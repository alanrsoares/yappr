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
});
