import { queryOptions } from "@tanstack/react-query";
import { type VoiceId } from "@yappr/sdk/schemas";
import { TTSClient } from "@yappr/sdk/tts";

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
