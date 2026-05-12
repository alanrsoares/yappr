import type { ModelMessage, ServerTool } from "@tanstack/ai";
import { toError } from "@yappr/lib/result";
import { ResultAsync } from "neverthrow";

import { MCP_CONFIG_PATH } from "../../../constants.js";
import type { ChatOptions, NarrationOptions } from "../../../types.js";
import {
  createOpenRouterChat,
  type OpenRouterTextMessage,
} from "../openrouter.js";
import { buildChatModelMessages } from "./messages.js";
import { defaultChatRuntime, type ChatRuntime } from "./runtime.js";

function throwIfChatAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("Chat was cancelled.");
    err.name = "AbortError";
    throw err;
  }
}

const NARRATION_SYSTEM = `You are a narrator. Given an assistant's reply that may contain code, tables, diagrams, or markdown, produce a short spoken version suitable for text-to-speech.
Rules: Output ONLY the narration, no preamble or "Here is the narration". Use plain language. Summarize or describe code blocks, tables, and diagrams instead of reading them verbatim. Keep the same meaning and tone.`;

export function narrateResponse(
  rawResponse: string,
  options: NarrationOptions,
): ResultAsync<string, Error> {
  const {
    model,
    provider = "ollama",
    ollamaBaseUrl,
    openrouterApiKey,
    runtime = defaultChatRuntime,
  } = options;
  const messages = [
    { role: "system" as const, content: NARRATION_SYSTEM },
    { role: "user" as const, content: rawResponse },
  ];
  if (provider === "openrouter" && openrouterApiKey?.trim()) {
    return ResultAsync.fromPromise(
      runtime.fetchOpenRouterChatCompletion(
        model,
        openrouterApiKey.trim(),
        messages,
      ),
      toError,
    );
  }
  const client = runtime.getOllamaClient(ollamaBaseUrl);
  return ResultAsync.fromPromise(
    client
      .chat({ model, messages, stream: false })
      .then((r) => r.message.content ?? ""),
    toError,
  );
}

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
    systemPrompts: explicitSystemPrompts,
    abortController,
    onToolCall,
    runtime = defaultChatRuntime,
  } = options;
  const mcp = runtime.createMcpManager();

  const systemPrompts: string[] = explicitSystemPrompts ?? [];
  const messages: ModelMessage<string>[] = buildChatModelMessages(
    prompt,
    priorMessages,
  );

  return mcp
    .loadConfigAndGetStatuses(mcpConfigPath ?? MCP_CONFIG_PATH)
    .andThen(() => {
      if (provider === "openrouter") {
        const openRouterMessages: OpenRouterTextMessage[] =
          systemPrompts.length > 0
            ? [
                { role: "system", content: systemPrompts.join("\n\n") },
                ...messages,
              ]
            : messages;
        const openRouterAdapter = runtime.createOpenRouterChat(
          model,
          openrouterApiKey ?? "",
        );
        return ResultAsync.fromPromise(
          streamOpenRouterAndCollect(
            openRouterAdapter,
            openRouterMessages,
            abortController,
            onUpdate,
            mcp,
          ),
          toError,
        );
      }

      const tools = useTools ? mcp.getTanStackTools() : [];
      const ollamaAdapter = runtime.createOllamaChat(model, ollamaBaseUrl);
      return ResultAsync.fromPromise(
        streamOllamaAndCollect(
          runtime,
          {
            adapter: ollamaAdapter,
            messages,
            systemPrompts,
            tools,
            abortController,
            onUpdate,
            onToolCall,
          },
          mcp,
        ),
        toError,
      );
    });
}

async function streamOpenRouterAndCollect(
  openRouterAdapter: ReturnType<typeof createOpenRouterChat>,
  openRouterMessages: OpenRouterTextMessage[],
  abortController: AbortController | undefined,
  onUpdate: ChatOptions["onUpdate"],
  mcp: { close: () => Promise<void> },
): Promise<string | null> {
  try {
    let finalContent = "";
    for await (const chunk of openRouterAdapter.chatStream({
      messages: openRouterMessages,
      request: abortController ? { signal: abortController.signal } : undefined,
    })) {
      throwIfChatAborted(abortController?.signal);
      if (chunk.type === "RUN_ERROR")
        throw new Error(chunk.error?.message ?? "OpenRouter error");
      if (chunk.type === "content" && chunk.delta) {
        finalContent += chunk.delta;
        onUpdate?.(finalContent);
      }
    }
    throwIfChatAborted(abortController?.signal);
    return finalContent || null;
  } finally {
    await mcp.close();
  }
}

async function streamOllamaAndCollect(
  runtime: ChatRuntime,
  args: {
    adapter: ReturnType<ChatRuntime["createOllamaChat"]>;
    messages: ModelMessage<string>[];
    systemPrompts: string[];
    tools: ServerTool<unknown, unknown>[];
    abortController: AbortController | undefined;
    onUpdate: ChatOptions["onUpdate"];
    onToolCall: ChatOptions["onToolCall"];
  },
  mcp: { close: () => Promise<void> },
): Promise<string | null> {
  try {
    const stream = runtime.tanstackChat({
      adapter: args.adapter,
      messages: args.messages,
      ...(args.systemPrompts.length > 0 && {
        systemPrompts: args.systemPrompts,
      }),
      tools: args.tools,
      ...(args.abortController && { abortController: args.abortController }),
    });

    let finalContent = "";
    for await (const chunk of stream) {
      throwIfChatAborted(args.abortController?.signal);
      if (chunk.type === "content" || chunk.type === "TEXT_MESSAGE_CONTENT") {
        const delta = "delta" in chunk ? chunk.delta : "";
        finalContent += delta;
        args.onUpdate?.(finalContent);
      } else if (chunk.type === "TOOL_CALL_START" && "toolName" in chunk) {
        args.onToolCall?.(chunk.toolName, "start");
      } else if (chunk.type === "TOOL_CALL_END" && "toolName" in chunk) {
        args.onToolCall?.(chunk.toolName, "end");
      } else if (chunk.type === "RUN_ERROR") {
        throw new Error(chunk.error.message);
      }
    }
    throwIfChatAborted(args.abortController?.signal);
    return finalContent || null;
  } finally {
    await mcp.close();
  }
}
