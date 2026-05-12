import {
  convertToModelMessages,
  streamText,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { createOllama } from "ollama-ai-provider-v2";

import { ollamaRoot } from "~/lib/ollama";

/**
 * AI SDK v6 `ChatTransport` that streams from the local Ollama daemon
 * directly inside the webview — no Next.js-style API route required.
 *
 * The provider's `baseURL` follows our Vite proxy in dev (`/ollama/api`) and
 * the Electrobun build's direct loopback (`http://127.0.0.1:11434/api`).
 *
 * Model is read via a getter on every send so that callers can change the
 * selected model without re-instantiating the transport — `useChat` freezes
 * the transport reference at first render, so a stable instance whose
 * behaviour follows the latest model state is what we need.
 */
export class OllamaTransport implements ChatTransport<UIMessage> {
  constructor(private readonly getModel: () => string) {}

  async sendMessages({
    messages,
    abortSignal,
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const provider = createOllama({ baseURL: `${ollamaRoot()}/api` });
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: provider(this.getModel()),
      messages: modelMessages,
      abortSignal,
    });
    return result.toUIMessageStream();
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
