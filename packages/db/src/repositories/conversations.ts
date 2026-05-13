import { desc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../schema.js";

type Db = BunSQLiteDatabase<typeof schema>;

export interface NewConversationInput {
  id?: string; // auto-generated if absent
  title: string;
  model?: string;
}

const newId = (): string =>
  `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export type ConversationListScope = "active" | "archived" | "all";

export interface ConversationListOptions {
  limit?: number;
}

const clampLimit = (limit: number | undefined) =>
  Math.min(Math.max(limit ?? 200, 1), 1_000);

export function makeConversationsRepo(db: Db) {
  return {
    list(
      scope: ConversationListScope = "active",
      options?: ConversationListOptions,
    ): schema.Conversation[] {
      const order = desc(schema.conversations.updatedAt);
      if (scope === "all") {
        return db
          .select()
          .from(schema.conversations)
          .orderBy(order)
          .limit(clampLimit(options?.limit))
          .all();
      }
      const archivedInt = scope === "archived" ? 1 : 0;
      return db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.archived, archivedInt))
        .orderBy(order)
        .limit(clampLimit(options?.limit))
        .all();
    },

    get(id: string): schema.Conversation | null {
      return (
        db
          .select()
          .from(schema.conversations)
          .where(eq(schema.conversations.id, id))
          .get() ?? null
      );
    },

    create(input: NewConversationInput): schema.Conversation {
      const now = Date.now();
      const id = input.id ?? newId();
      const row: schema.NewConversation = {
        id,
        title: input.title,
        model: input.model ?? null,
        archived: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(schema.conversations).values(row).run();
      return { ...row, model: row.model ?? null } as schema.Conversation;
    },

    rename(id: string, title: string): void {
      db.update(schema.conversations)
        .set({ title, updatedAt: Date.now() })
        .where(eq(schema.conversations.id, id))
        .run();
    },

    touch(id: string): void {
      db.update(schema.conversations)
        .set({ updatedAt: Date.now() })
        .where(eq(schema.conversations.id, id))
        .run();
    },

    setArchived(id: string, archived: boolean): void {
      db.update(schema.conversations)
        .set({ archived: archived ? 1 : 0, updatedAt: Date.now() })
        .where(eq(schema.conversations.id, id))
        .run();
    },

    delete(id: string): void {
      // Messages cascade via FK.
      db.delete(schema.conversations)
        .where(eq(schema.conversations.id, id))
        .run();
    },
  };
}

export type ConversationsRepo = ReturnType<typeof makeConversationsRepo>;
