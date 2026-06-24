import type { ChatRuntime } from "../runtime.js";
import type { ChatStreamRequest, ChatTransport } from "../transport.js";
import { streamTanstackChat } from "./tanstack-chat.js";

export interface OllamaTransportConfig {
  model: string;
  baseUrl?: string | undefined;
}

/** {@link ChatTransport} for Ollama via `@tanstack/ai-ollama`. */
export function createOllamaChatTransport(
  runtime: ChatRuntime,
  config: OllamaTransportConfig,
): ChatTransport {
  return {
    name: "ollama",
    stream: (req: ChatStreamRequest) =>
      streamTanstackChat(
        runtime,
        runtime.createOllamaChat(config.model, config.baseUrl),
        req,
      ),
  };
}
