import { toError } from "@yappr/lib/result";
import type { TurnTelemetry } from "@yappr/lib/telemetry";
import { Effect } from "effect";
import { match } from "ts-pattern";

import { MCP_CONFIG_PATH } from "../../../constants.js";
import type { ChatOptions } from "../../../types.js";
import { buildChatModelMessages } from "./messages.js";
import { defaultChatRuntime } from "./runtime.js";
import {
  type ChatStreamRequest,
  type ChatTransport,
  createChatTransport,
} from "./transport.js";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("Chat was cancelled.");
    err.name = "AbortError";
    throw err;
  }
}

/**
 * One-shot chat call: load MCP tools, build the prompt history, pick a
 * provider adapter via {@link createChatTransport}, then drain its event
 * stream into a single string. Adapter selection is the only place provider
 * dispatch happens — orchestration here is provider-agnostic.
 */
export function chat(
  prompt: string,
  options: ChatOptions = {},
): Effect.Effect<string | null, Error> {
  const {
    provider = "ollama",
    model = "qwen2.5:14b",
    ollamaBaseUrl,
    openrouterApiKey,
    mcpConfigPath,
    useTools = true,
    onUpdate,
    messages: priorMessages = [],
    images = [],
    systemPrompts = [],
    abortController,
    onToolCall,
    onTelemetry,
    runtime = defaultChatRuntime,
  } = options;

  const mcp = runtime.createMcpManager();
  const messages = buildChatModelMessages(prompt, priorMessages, images);
  const transport = createChatTransport(runtime, {
    provider,
    model,
    ollamaBaseUrl,
    openrouterApiKey,
  });

  return mcp.loadConfigAndGetStatuses(mcpConfigPath ?? MCP_CONFIG_PATH).pipe(
    Effect.flatMap(() => {
      const req: ChatStreamRequest = {
        messages,
        systemPrompts,
        tools: useTools ? mcp.getTanStackTools() : [],
        ...(abortController && { signal: abortController.signal }),
      };
      return Effect.tryPromise({
        try: () =>
          drainStream(
            transport,
            req,
            { onUpdate, onToolCall, onTelemetry },
            mcp,
          ),
        catch: toError,
      });
    }),
  );
}

interface ChatCallbacks {
  onUpdate: ChatOptions["onUpdate"];
  onToolCall: ChatOptions["onToolCall"];
  onTelemetry: ChatOptions["onTelemetry"];
}

async function drainStream(
  transport: ChatTransport,
  req: ChatStreamRequest,
  callbacks: ChatCallbacks,
  mcp: { close: () => Promise<void> },
): Promise<string | null> {
  let finalContent = "";
  let usage: Omit<TurnTelemetry, "latencyMs"> | null = null;
  const startedAt = Date.now();
  try {
    for await (const event of transport.stream(req)) {
      throwIfAborted(req.signal);
      // Usage is captured outside the match so control-flow analysis can
      // narrow `usage` after the loop (closure writes are invisible to CFA).
      if (event.type === "usage") {
        usage = event.usage;
        continue;
      }
      match(event)
        .with({ type: "delta" }, (e) => {
          finalContent += e.text;
          callbacks.onUpdate?.(finalContent);
        })
        .with({ type: "tool" }, (e) => callbacks.onToolCall?.(e.name, e.phase))
        .with({ type: "error" }, (e) => {
          throw new Error(e.message);
        })
        .exhaustive();
    }
    throwIfAborted(req.signal);
    if (usage) {
      callbacks.onTelemetry?.({ ...usage, latencyMs: Date.now() - startedAt });
    }
    return finalContent || null;
  } finally {
    await mcp.close();
  }
}
