import type { ChatRuntime } from "../runtime.js";
import type { ChatStreamRequest, ChatTransport } from "../transport.js";
import { streamTanstackChat } from "./tanstack-chat.js";

export interface OpenRouterTransportConfig {
  model: string;
  apiKey: string;
}

/**
 * {@link ChatTransport} for OpenRouter via `@tanstack/ai-openrouter`. Routes
 * through `@tanstack/ai` like the Ollama path, so tool-calling + the bounded
 * agent loop + usage telemetry work uniformly (the previous bespoke SSE client
 * dropped tools).
 */
export const createOpenRouterChatTransport = (
  runtime: ChatRuntime,
  config: OpenRouterTransportConfig,
): ChatTransport => ({
  name: "openrouter",
  stream: (req: ChatStreamRequest) =>
    streamTanstackChat(
      runtime,
      // OpenRouter model ids are user-configured; the adapter's model union
      // is autocomplete-only, so accept any string.
      runtime.createOpenRouterText(
        config.model as Parameters<ChatRuntime["createOpenRouterText"]>[0],
        config.apiKey,
      ),
      req,
    ),
});
