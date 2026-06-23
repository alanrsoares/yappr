import { maxIterations } from "@tanstack/ai";

import type { ChatRuntime } from "../runtime.js";
import type {
  ChatStreamEvent,
  ChatStreamRequest,
  ChatTransport,
} from "../transport.js";

export interface OllamaTransportConfig {
  model: string;
  baseUrl?: string | undefined;
}

/**
 * Upper bound on agent-loop iterations (tool round-trips) per turn. Bounds the
 * multi-step tool loop so a model that keeps calling tools can't run away; the
 * tool-call trace surfaces each round, so hitting the cap is visible.
 */
const MAX_TOOL_ITERATIONS = 8;

/**
 * {@link ChatTransport} adapter wrapping `@tanstack/ai` + `@tanstack/ai-ollama`.
 * Translates the SDK's chunk types (`TEXT_MESSAGE_CONTENT`, `TOOL_CALL_*`,
 * `RUN_ERROR`) into provider-agnostic {@link ChatStreamEvent}s.
 */
export function createOllamaChatTransport(
  runtime: ChatRuntime,
  config: OllamaTransportConfig,
): ChatTransport {
  return {
    name: "ollama",
    async *stream(req: ChatStreamRequest): AsyncIterable<ChatStreamEvent> {
      const adapter = runtime.createOllamaChat(config.model, config.baseUrl);
      const abortController = req.signal
        ? toAbortController(req.signal)
        : undefined;
      const stream = runtime.tanstackChat({
        adapter,
        messages: [...req.messages],
        ...(req.systemPrompts.length > 0 && {
          systemPrompts: [...req.systemPrompts],
        }),
        tools: [...req.tools],
        // Bounded multi-step agent loop, but only when tools are present —
        // a tool-less turn stays single-shot.
        ...(req.tools.length > 0 && {
          agentLoopStrategy: maxIterations(MAX_TOOL_ITERATIONS),
        }),
        ...(abortController && { abortController }),
      });

      for await (const chunk of stream) {
        if (chunk.type === "TEXT_MESSAGE_CONTENT") {
          const text = chunk.delta ?? "";
          if (text) yield { type: "delta", text };
        } else if (chunk.type === "TOOL_CALL_START" && "toolName" in chunk) {
          yield { type: "tool", phase: "start", name: chunk.toolName };
        } else if (chunk.type === "TOOL_CALL_END" && "toolName" in chunk) {
          if (chunk.toolName) {
            yield { type: "tool", phase: "end", name: chunk.toolName };
          }
        } else if (chunk.type === "RUN_ERROR") {
          yield {
            type: "error",
            message: chunk.error?.message ?? "Chat stream error",
          };
        } else if (chunk.type === "RUN_FINISHED" && chunk.usage) {
          const u = chunk.usage;
          yield {
            type: "usage",
            usage: {
              promptTokens: u.promptTokens,
              completionTokens: u.completionTokens,
              totalTokens: u.totalTokens,
              ...(typeof u.cost === "number" ? { cost: u.cost } : {}),
            },
          };
        }
      }
    },
  };
}

/** `@tanstack/ai` expects an `AbortController`, not a bare `AbortSignal`. */
function toAbortController(signal: AbortSignal): AbortController {
  const ac = new AbortController();
  if (signal.aborted) ac.abort();
  else signal.addEventListener("abort", () => ac.abort(), { once: true });
  return ac;
}
