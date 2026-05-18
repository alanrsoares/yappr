import { toError } from "@yappr/lib/result";
import { okAsync, ResultAsync } from "neverthrow";

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

export function persistChatEvent(event: ChatEvent): ResultAsync<void, Error> {
  if (!isDurableChatEvent(event)) return okAsync();

  return ResultAsync.fromPromise(
    (async () => {
      const db = getDb();
      db.agentEvents.append({
        id: event.id,
        conversationId: event.conversationId,
        runId: event.runId,
        type: event.type,
        eventJson: JSON.stringify(event),
        createdAt: event.timestamp,
      });
    })(),
    toError,
  );
}

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

export function listPersistedChatEvents(
  conversationId: string,
): ResultAsync<ChatEvent[], Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const db = getDb();
      return db.agentEvents
        .listForConversation(conversationId)
        .map((row) => parsePersistedEvent(row.eventJson))
        .filter((event): event is ChatEvent => event !== null);
    })(),
    toError,
  );
}
