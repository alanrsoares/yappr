import { asc, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../schema.js";

type Db = BunSQLiteDatabase<typeof schema>;

export interface NewAgentEventInput {
  id: string;
  conversationId: string | null;
  runId: string;
  type: string;
  eventJson: string;
  createdAt: number;
}

export interface AgentEventListOptions {
  limit?: number;
}

const clampLimit = (limit: number | undefined) =>
  Math.min(Math.max(limit ?? 1000, 1), 10_000);

export const makeAgentEventsRepo = (db: Db) => ({
  listForConversation(
    conversationId: string,
    options?: AgentEventListOptions,
  ): schema.AgentEvent[] {
    return db
      .select()
      .from(schema.agentEvents)
      .where(eq(schema.agentEvents.conversationId, conversationId))
      .orderBy(asc(schema.agentEvents.createdAt))
      .limit(clampLimit(options?.limit))
      .all();
  },

  listForRun(
    runId: string,
    options?: AgentEventListOptions,
  ): schema.AgentEvent[] {
    return db
      .select()
      .from(schema.agentEvents)
      .where(eq(schema.agentEvents.runId, runId))
      .orderBy(asc(schema.agentEvents.createdAt))
      .limit(clampLimit(options?.limit))
      .all();
  },

  append(input: NewAgentEventInput): schema.AgentEvent {
    const row: schema.NewAgentEvent = {
      id: input.id,
      conversationId: input.conversationId,
      runId: input.runId,
      type: input.type,
      eventJson: input.eventJson,
      createdAt: input.createdAt,
    };
    db.transaction((tx) => {
      tx.insert(schema.agentEvents).values(row).run();
      if (input.conversationId) {
        tx.update(schema.conversations)
          .set({ updatedAt: input.createdAt })
          .where(eq(schema.conversations.id, input.conversationId))
          .run();
      }
    });
    return row as schema.AgentEvent;
  },
});

export type AgentEventsRepo = ReturnType<typeof makeAgentEventsRepo>;
