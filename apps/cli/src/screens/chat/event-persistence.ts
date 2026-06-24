import { toError } from "@yappr/lib/result";
import { Effect } from "effect";

import { getDb } from "~/lib/db.js";
import type { ChatEvent } from "./events.js";

const DURABLE_EVENT_TYPES = new Set<ChatEvent["type"]>([
  "run.start",
  "run.end",
  "message.user",
  "message.assistant",
  "tool.call",
  "tool.result",
  "tts.start",
  "tts.end",
  "stt.transcript",
  "stt.end",
  "system",
]);

export const isDurableChatEvent = (event: ChatEvent) =>
  DURABLE_EVENT_TYPES.has(event.type);

export const persistChatEvent = (
  event: ChatEvent,
): Effect.Effect<void, Error> =>
  !isDurableChatEvent(event)
    ? Effect.void
    : Effect.try({
        try: () => {
          const db = getDb();
          db.agentEvents.append({
            id: event.id,
            conversationId: event.conversationId,
            runId: event.runId,
            type: event.type,
            eventJson: JSON.stringify(event),
            createdAt: event.timestamp,
          });
        },
        catch: toError,
      });

/** Parse a persisted row, dropping malformed JSON or shape mismatches. */
function parsePersistedEvent(eventJson: string): ChatEvent | null {
  try {
    const parsed = JSON.parse(eventJson) as ChatEvent;
    return typeof parsed.id === "string" &&
      typeof parsed.runId === "string" &&
      typeof parsed.type === "string" &&
      typeof parsed.timestamp === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export const listPersistedChatEvents = (
  conversationId: string,
): Effect.Effect<ChatEvent[], Error> =>
  Effect.try({
    try: () => {
      const db = getDb();
      return db.agentEvents
        .listForConversation(conversationId)
        .map((row) => parsePersistedEvent(row.eventJson))
        .filter((event): event is ChatEvent => event !== null);
    },
    catch: toError,
  });
