import { chat } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { stream } from "@tanstack/ai-react";

import { ollamaRoot } from "./index";

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
 * Model is read through `getModel` on every send so callers can switch models
 * without recreating the connection — `useChat` freezes the adapter reference
 * at first render, so a stable adapter whose behaviour follows the latest model
 * state is what we need.
 */
export function createOllamaConnection(getModel: () => string) {
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
    return chat({ adapter, messages, abortController });
  });
}
