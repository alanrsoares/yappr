import { asc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../schema.js";

type Db = BunSQLiteDatabase<typeof schema>;

export interface NewMessageInput {
  id?: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  partsJson?: string | null;
}

const newId = (): string =>
  `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function makeMessagesRepo(db: Db) {
  return {
    list(conversationId: string): schema.Message[] {
      return db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(asc(schema.messages.createdAt))
        .all();
    },

    append(input: NewMessageInput): schema.Message {
      const now = Date.now();
      const row: schema.NewMessage = {
        id: input.id ?? newId(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        partsJson: input.partsJson ?? null,
        createdAt: now,
      };
      // Append message + bump the conversation's updatedAt in one transaction
      // so the sidebar's "most recent first" ordering stays accurate.
      db.transaction((tx) => {
        tx.insert(schema.messages).values(row).run();
        tx.update(schema.conversations)
          .set({ updatedAt: now })
          .where(eq(schema.conversations.id, input.conversationId))
          .run();
      });
      return row as schema.Message;
    },

    delete(id: string): void {
      db.delete(schema.messages).where(eq(schema.messages.id, id)).run();
    },
  };
}

export type MessagesRepo = ReturnType<typeof makeMessagesRepo>;
