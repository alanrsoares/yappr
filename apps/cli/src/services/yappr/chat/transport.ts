import type { ModelMessage, SchemaInput, Tool } from "@tanstack/ai";
import type { TurnTelemetry } from "@yappr/lib/telemetry";
import { match } from "ts-pattern";

import type { ChatProvider } from "../../../types.js";
import { createOllamaChatTransport } from "./adapters/ollama-transport.js";
import { createOpenRouterChatTransport } from "./adapters/openrouter-transport.js";
import type { ChatRuntime } from "./runtime.js";

/**
 * Provider-agnostic chat transport port.
 *
 * Mirrors the desktop's use of Vercel AI SDK's `ChatTransport<UIMessage>`:
 * the orchestrator (`session.ts → chat()`) iterates a single async stream of
 * normalized {@link ChatStreamEvent}s, and concrete adapters
 * (Ollama / OpenRouter) handle provider-specific message shapes + chunk
 * decoding inside their {@link ChatTransport.stream} implementations.
 */
export interface ChatStreamRequest {
  messages: ModelMessage[];
  systemPrompts: readonly string[];
  tools: ReadonlyArray<Tool<SchemaInput, SchemaInput>>;
  signal?: AbortSignal;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string }
  | { type: "usage"; usage: Omit<TurnTelemetry, "latencyMs"> }
  | { type: "error"; message: string };

export interface ChatTransport {
  /** Stable adapter id — `"ollama"`, `"openrouter"`, etc. Used in logs. */
  readonly name: ChatProvider;
  stream(req: ChatStreamRequest): AsyncIterable<ChatStreamEvent>;
}

export interface ChatTransportConfig {
  provider: ChatProvider;
  model: string;
  ollamaBaseUrl?: string | undefined;
  openrouterApiKey?: string | undefined;
}

/**
 * Composition root for the chat transport. Pick once per `chat()` call.
 * Adding a new provider = new adapter file + new branch here; the
 * orchestrator code does not change.
 */
export const createChatTransport = (
  runtime: ChatRuntime,
  config: ChatTransportConfig,
): ChatTransport =>
  match(config.provider)
    .with("openrouter", () =>
      createOpenRouterChatTransport(runtime, {
        model: config.model,
        apiKey: config.openrouterApiKey ?? "",
      }),
    )
    .with("ollama", () =>
      createOllamaChatTransport(runtime, {
        model: config.model,
        baseUrl: config.ollamaBaseUrl,
      }),
    )
    .exhaustive();
