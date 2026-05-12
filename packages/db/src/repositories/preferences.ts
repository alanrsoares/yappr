import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../schema.js";

type Db = BunSQLiteDatabase<typeof schema>;

/**
 * KV preferences repository. Values are JSON-stringified at write and parsed
 * at read; callers validate with their own zod schemas (per-app). Synchronous
 * because bun:sqlite is sync — wrap in ResultAsync at the consumer edge if
 * the surrounding code expects async.
 */
export function makePreferencesRepo(db: Db) {
  return {
    get<T>(key: string): T | null {
      const row = db
        .select()
        .from(schema.preferences)
        .where(eq(schema.preferences.key, key))
        .get();
      if (!row) return null;
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    },

    getAll(): Record<string, unknown> {
      const rows = db.select().from(schema.preferences).all();
      const out: Record<string, unknown> = {};
      for (const r of rows) {
        try {
          out[r.key] = JSON.parse(r.value);
        } catch {
          // ignore corrupt row
        }
      }
      return out;
    },

    set(key: string, value: unknown): void {
      const now = Date.now();
      db.insert(schema.preferences)
        .values({ key, value: JSON.stringify(value), updatedAt: now })
        .onConflictDoUpdate({
          target: schema.preferences.key,
          set: { value: JSON.stringify(value), updatedAt: now },
        })
        .run();
    },

    setMany(entries: Record<string, unknown>): void {
      // Single transaction so partial writes don't leave drift.
      const now = Date.now();
      const items = Object.entries(entries);
      if (items.length === 0) return;
      db.transaction((tx) => {
        for (const [key, value] of items) {
          tx.insert(schema.preferences)
            .values({ key, value: JSON.stringify(value), updatedAt: now })
            .onConflictDoUpdate({
              target: schema.preferences.key,
              set: { value: JSON.stringify(value), updatedAt: now },
            })
            .run();
        }
      });
    },

    delete(key: string): void {
      db.delete(schema.preferences)
        .where(eq(schema.preferences.key, key))
        .run();
    },

    /**
     * Total count of user-visible keys (excluding internal book-keeping like
     * `_schema_version`). Used to detect a fresh DB for first-run JSON import.
     */
    count(): number {
      const rows = db.select().from(schema.preferences).all();
      return rows.filter((r) => !r.key.startsWith("_")).length;
    },
  };
}

export type PreferencesRepo = ReturnType<typeof makePreferencesRepo>;
