import { chat, maxIterations, type SchemaInput, type Tool } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { stream } from "@tanstack/ai-react";

import { ollamaRoot } from "./index";

/** Upper bound on agent-loop tool round-trips per turn — mirrors the CLI. */
const MAX_TOOL_ITERATIONS = 8;

type McpTools = Array<Tool<SchemaInput, SchemaInput>>;

/**
 * In-process TanStack AI connection adapter that streams from the local Ollama
 * daemon directly inside the webview — no server route required. `stream()`
 * wires the `AsyncIterable<StreamChunk>` from `chat()` straight into the
 * `ChatClient`, so the same engine the CLI uses (`@tanstack/ai` +
 * `@tanstack/ai-ollama`) drives the desktop too.
 *
 * Host comes from {@link ollamaRoot} (same-origin Vite proxy in dev, loopback
 * daemon in the packaged build); the client appends `/api/chat` itself.
 *
 * Model + tools are read through getters on every send so callers can switch
 * models or have MCP tools arrive after first render — `useChat` freezes the
 * adapter reference at first render, so a stable adapter whose behaviour follows
 * the latest state is what we need. When tools are present the bounded
 * multi-step agent loop is enabled (tools-only, matching the CLI); a tool-less
 * turn stays single-shot.
 */
export function createOllamaConnection(
  getModel: () => string,
  getTools: () => McpTools = () => [],
) {
  return stream((messages, _data, abortSignal) => {
    const adapter = createOllamaChat(getModel(), ollamaRoot());
    const abortController = new AbortController();
    if (abortSignal) {
      if (abortSignal.aborted) abortController.abort();
      else
        abortSignal.addEventListener("abort", () => abortController.abort(), {
          once: true,
        });
    }
    const tools = getTools();
    return chat({
      adapter,
      messages,
      abortController,
      ...(tools.length > 0 && {
        tools,
        agentLoopStrategy: maxIterations(MAX_TOOL_ITERATIONS),
      }),
    });
  });
}
