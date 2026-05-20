import { toError } from "@yappr/lib/result";
import { ResultAsync } from "neverthrow";

import { MCP_CONFIG_PATH } from "../../../constants.js";
import type { ChatOptions } from "../../../types.js";
import { buildChatModelMessages } from "./messages.js";
import { defaultChatRuntime } from "./runtime.js";
import {
  createChatTransport,
  type ChatStreamRequest,
  type ChatTransport,
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
): ResultAsync<string | null, Error> {
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

  return mcp
    .loadConfigAndGetStatuses(mcpConfigPath ?? MCP_CONFIG_PATH)
    .andThen(() => {
      const req: ChatStreamRequest = {
        messages,
        systemPrompts,
        tools: useTools ? mcp.getTanStackTools() : [],
        ...(abortController && { signal: abortController.signal }),
      };
      return ResultAsync.fromPromise(
        drainStream(transport, req, { onUpdate, onToolCall }, mcp),
        toError,
      );
    });
}

interface ChatCallbacks {
  onUpdate: ChatOptions["onUpdate"];
  onToolCall: ChatOptions["onToolCall"];
}

async function drainStream(
  transport: ChatTransport,
  req: ChatStreamRequest,
  callbacks: ChatCallbacks,
  mcp: { close: () => Promise<void> },
): Promise<string | null> {
  let finalContent = "";
  try {
    for await (const event of transport.stream(req)) {
      throwIfAborted(req.signal);
      switch (event.type) {
        case "delta": {
          finalContent += event.text;
          callbacks.onUpdate?.(finalContent);
          break;
        }
        case "tool": {
          callbacks.onToolCall?.(event.name, event.phase);
          break;
        }
        case "error": {
          throw new Error(event.message);
        }
      }
    }
    throwIfAborted(req.signal);
    return finalContent || null;
  } finally {
    await mcp.close();
  }
}
