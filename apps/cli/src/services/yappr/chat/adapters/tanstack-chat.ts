import { maxIterations } from "@tanstack/ai";

import type { ChatRuntime } from "../runtime.js";
import type { ChatStreamEvent, ChatStreamRequest } from "../transport.js";

/**
 * Upper bound on agent-loop iterations (tool round-trips) per turn. Bounds the
 * multi-step tool loop so a model that keeps calling tools can't run away; the
 * tool-call trace surfaces each round, so hitting the cap is visible.
 */
const MAX_TOOL_ITERATIONS = 8;

/** The adapter shape `tanstackChat` accepts (Ollama, OpenRouter, …). */
type ChatAdapter = Parameters<ChatRuntime["tanstackChat"]>[0]["adapter"];

/** `@tanstack/ai` expects an `AbortController`, not a bare `AbortSignal`. */
function toAbortController(signal: AbortSignal): AbortController {
  const ac = new AbortController();
  if (signal.aborted) ac.abort();
  else signal.addEventListener("abort", () => ac.abort(), { once: true });
  return ac;
}

/**
 * Run a `@tanstack/ai` chat stream for any adapter and normalise its AG-UI
 * chunks into provider-agnostic {@link ChatStreamEvent}s. Shared by the Ollama
 * and OpenRouter transports so tool-calling, the bounded agent loop, and usage
 * telemetry behave identically across providers.
 */
export async function* streamTanstackChat(
  runtime: ChatRuntime,
  adapter: ChatAdapter,
  req: ChatStreamRequest,
): AsyncIterable<ChatStreamEvent> {
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
}
