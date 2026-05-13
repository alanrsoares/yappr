import { queryOptions } from "@tanstack/react-query";
import type { VoiceId } from "@yappr/sdk/schemas";
import { TTSClient } from "@yappr/sdk/tts";

import { dbRpc } from "~/lib/db-rpc";
import { listOllamaModels } from "~/lib/ollama";

/**
 * Shared TanStack Query options. Keep keys + queryFns here so call sites stay
 * a one-liner and `invalidateQueries` is type-safe. Per the project directive,
 * every React async read must go through `@tanstack/react-query`.
 */

/** Models the local Ollama daemon has pulled (`GET /api/tags`). */
export const ollamaModelsOptions = queryOptions({
  queryKey: ["ollama", "models"] as const,
  queryFn: ({ signal }) => listOllamaModels(signal),
  // /api/tags is essentially free + local — refresh on focus + every 60s
  // is fine, but no need to poll aggressively.
  staleTime: 60 * 1000,
});

/**
 * Yappr inference server voice list (`GET /voices`). Doubles as the backend
 * connectivity probe — the query state IS the health signal:
 *   - `isPending` (no data yet) → checking
 *   - `isError` → fail
 *   - `data` defined → ok
 *
 * Refetches automatically on mount, on window focus, every 30s while idle,
 * and whenever `serverUrl` changes (different cache key).
 */
export const voicesOptions = (serverUrl: string) =>
  queryOptions({
    queryKey: ["yappr", "voices", serverUrl] as const,
    queryFn: async ({ signal }): Promise<VoiceId[]> => {
      const client = new TTSClient(serverUrl);
      const result = await client.listVoices();
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      return result.match(
        (voices) => voices,
        (err) => {
          throw err;
        },
      );
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 0,
  });

// ---- DB-backed queries (via Electrobun RPC → bun → @yappr/db) -------------

/**
 * KV preferences blob. Reads + writes go through the bun-side `@yappr/db`,
 * which shares ~/.yappr/yappr.db with the CLI. Treat as the source of truth
 * for voice/model/server settings; mutations should `invalidateQueries` this
 * key after save.
 */
export const preferencesOptions = queryOptions({
  queryKey: ["db", "preferences"] as const,
  queryFn: () => dbRpc.request("preferences:getAll", undefined),
  staleTime: Infinity,
});

/** Shared prefix so mutations can invalidate every conversation-scoped query. */
export const conversationsQueryRootKey = ["db", "conversations"] as const;

/** Active (non-archived) conversations, newest-updated first. Main sidebar. */
export const conversationsOptions = queryOptions({
  queryKey: [...conversationsQueryRootKey, "active"] as const,
  queryFn: () => dbRpc.request("conversations:list", { scope: "active" }),
  staleTime: 5 * 1000,
});

/** Archived conversations for the sidebar secondary section. */
export const archivedConversationsOptions = queryOptions({
  queryKey: [...conversationsQueryRootKey, "archived"] as const,
  queryFn: () => dbRpc.request("conversations:list", { scope: "archived" }),
  staleTime: 5 * 1000,
});

/** Messages for a single conversation. Returns [] if none yet. */
export const messagesOptions = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["db", "messages", conversationId] as const,
    queryFn: () => {
      if (!conversationId) return Promise.resolve([]);
      return dbRpc.request("messages:list", { conversationId });
    },
    enabled: Boolean(conversationId),
    staleTime: Infinity, // streaming appends drive invalidation manually
  });
