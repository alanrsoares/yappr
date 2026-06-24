import { toError } from "@yappr/lib/result";
import { Effect } from "effect";

import type { ChatMessage } from "../types.js";
import { getDb } from "./db.js";

/**
 * Conversation + message persistence for the CLI TUI. Same `~/.yappr/yappr.db`
 * the desktop talks to over RPC, so a chat persisted from either surface is
 * readable from the other.
 *
 * Conversations are auto-titled from the first user prompt (truncated to 48
 * chars). The TUI doesn't expose rename/delete yet — listing + appending is
 * enough to make sessions survive a restart.
 */

function truncateTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export interface PersistedConversation {
  id: string;
  title: string;
}

export function createConversationSync(
  firstPrompt: string,
  model: string | null,
): PersistedConversation {
  const db = getDb();
  const conv = db.conversations.create({
    title: truncateTitle(firstPrompt),
    model: model ?? undefined,
  });
  return { id: conv.id, title: conv.title };
}

/**
 * Append a single message and bump the conversation's `updatedAt` in one
 * transaction (handled inside the repo). Role mirrors the Ollama/OpenRouter
 * chat contract: `user` | `assistant` | `system`.
 */
export function appendMessage(
  conversationId: string,
  message: ChatMessage,
): Effect.Effect<void, Error> {
  return Effect.try({
    try: () => {
      const db = getDb();
      const role = message.role as "user" | "assistant" | "system";
      db.messages.append({
        conversationId,
        role,
        content: message.content,
      });
    },
    catch: toError,
  });
}
