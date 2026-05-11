import { okAsync, ResultAsync } from "neverthrow";

import { toError } from "~/lib/result.js";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterModelInfo {
  id: string;
  name: string;
}

interface OpenRouterModelArchitecture {
  input_modalities?: string[];
}

interface OpenRouterModelsListEntry {
  id?: string;
  name?: string;
  architecture?: OpenRouterModelArchitecture;
  supported_parameters?: string[];
}

interface OpenRouterModelsApiResponse {
  data?: OpenRouterModelsListEntry[];
}

type OpenRouterModelWithId = OpenRouterModelsListEntry & { id: string };

function isUsableOpenRouterModel(
  m: OpenRouterModelsListEntry,
): m is OpenRouterModelWithId {
  const hasText = m.architecture?.input_modalities?.includes("text") ?? true;
  const hasTools = m.supported_parameters?.includes("tools") ?? false;
  return Boolean(m.id && hasText && hasTools);
}

export interface OpenRouterTextMessage {
  role: string;
  content: string;
}

interface OpenRouterChatStreamOptions {
  messages: OpenRouterTextMessage[];
  request?: RequestInit;
}

interface OpenRouterStreamDelta {
  content?: string;
}

interface OpenRouterStreamChoice {
  delta?: OpenRouterStreamDelta;
}

interface OpenRouterStreamLinePayload {
  choices?: OpenRouterStreamChoice[];
}

interface OpenRouterCompletionMessageBody {
  content?: string;
}

interface OpenRouterCompletionChoice {
  message?: OpenRouterCompletionMessageBody;
}

interface OpenRouterChatCompletionResponse {
  choices?: OpenRouterCompletionChoice[];
}

interface OpenRouterRunErrorBody {
  message: string;
}

type OpenRouterStreamChunk =
  | { type: "RUN_ERROR"; error: OpenRouterRunErrorBody }
  | { type: "content"; delta: string; content: string };

interface OpenRouterChatAdapter {
  name: "openrouter";
  model: string;
  chatStream: (opts: OpenRouterChatStreamOptions) => AsyncIterable<OpenRouterStreamChunk>;
}

function mergeOpenRouterRequestHeaders(
  apiKey: string,
  request: RequestInit,
): Headers {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
}

export interface OpenRouterNarrationMessage {
  role: "system" | "user";
  content: string;
}

async function readOpenRouterFailureMessage(res: Response): Promise<string> {
  const text = await res.text();
  return `${res.status}: ${text}`;
}

async function throwOpenRouterHttpError(res: Response): Promise<never> {
  throw new Error(await readOpenRouterFailureMessage(res));
}

export function listOpenRouterModels(
  apiKey: string,
): ResultAsync<OpenRouterModelInfo[], Error> {
  if (!apiKey.trim()) {
    return okAsync([]);
  }
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetch(
        `${OPENROUTER_BASE}/models?supported_parameters=tools`,
        {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        },
      );
      if (!res.ok) await throwOpenRouterHttpError(res);
      const json = (await res.json()) as OpenRouterModelsApiResponse;
      const list = json.data ?? [];
      return list
        .filter(isUsableOpenRouterModel)
        .map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    })(),
    toError,
  );
}

export function createOpenRouterChat(
  model: string,
  apiKey: string,
): OpenRouterChatAdapter {
  return {
    name: "openrouter",
    model,
    async *chatStream({
      messages,
      request = {},
    }: OpenRouterChatStreamOptions): AsyncIterable<OpenRouterStreamChunk> {
      const body = {
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      };
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: mergeOpenRouterRequestHeaders(apiKey, request),
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (!res.ok) {
        yield {
          type: "RUN_ERROR",
          error: { message: await readOpenRouterFailureMessage(res) },
        };
        return;
      }
      let accumulated = "";
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data) as OpenRouterStreamLinePayload;
                const delta = json.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  accumulated += delta;
                  yield {
                    type: "content",
                    delta,
                    content: accumulated,
                  };
                }
              } catch {
                /* skip malformed SSE chunk */
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export async function fetchOpenRouterChatCompletion(
  model: string,
  apiKey: string,
  messages: OpenRouterNarrationMessage[],
): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });
  if (!res.ok) await throwOpenRouterHttpError(res);
  const data = (await res.json()) as OpenRouterChatCompletionResponse;
  return data.choices?.[0]?.message?.content ?? "";
}
