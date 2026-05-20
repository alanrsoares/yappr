import type { ModelMessage } from "@tanstack/ai";

import type { OpenRouterTextMessage } from "../../openrouter.js";
import type { ChatRuntime } from "../runtime.js";
import type {
  ChatStreamEvent,
  ChatStreamRequest,
  ChatTransport,
} from "../transport.js";

export interface OpenRouterTransportConfig {
  model: string;
  apiKey: string;
}

/**
 * {@link ChatTransport} adapter for the OpenRouter chat-completion API.
 *
 * OpenRouter's request shape is text-only — multimodal {@link ModelMessage}s
 * are flattened to their text parts before send. Tool execution isn't wired
 * on this path today (the OpenRouter MCP bridge lives separately); any tools
 * passed in the request are dropped silently.
 */
export function createOpenRouterChatTransport(
  runtime: ChatRuntime,
  config: OpenRouterTransportConfig,
): ChatTransport {
  return {
    name: "openrouter",
    async *stream(req: ChatStreamRequest): AsyncIterable<ChatStreamEvent> {
      const adapter = runtime.createOpenRouterChat(config.model, config.apiKey);
      const textOnly = req.messages.map(
        (m): OpenRouterTextMessage => ({
          role: m.role,
          content: flattenContentToText(m.content),
        }),
      );
      const messages: OpenRouterTextMessage[] =
        req.systemPrompts.length > 0
          ? [
              { role: "system", content: req.systemPrompts.join("\n\n") },
              ...textOnly,
            ]
          : textOnly;

      for await (const chunk of adapter.chatStream({
        messages,
        request: req.signal ? { signal: req.signal } : undefined,
      })) {
        if (chunk.type === "RUN_ERROR") {
          yield {
            type: "error",
            message: chunk.error?.message ?? "OpenRouter error",
          };
        } else if (chunk.type === "content" && chunk.delta) {
          yield { type: "delta", text: chunk.delta };
        }
      }
    },
  };
}

function flattenContentToText(
  content: ModelMessage["content"] | undefined,
): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.content : ""))
    .filter(Boolean)
    .join("\n");
}
