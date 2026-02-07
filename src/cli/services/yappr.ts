/**
 * Shared yappr actions for the TUI (and optionally CLI). Uses SDK + Ollama.
 * Public async API returns ResultAsync for consistent, functional error handling.
 */
import { mkdirSync } from "fs";
import path from "path";
import { chat as tanstackChat, type ModelMessage } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { spawn } from "bun";
import { okAsync, ResultAsync } from "neverthrow";
import ollama, { Ollama } from "ollama";

import {
  listInputDevices,
  listOutputDevices,
  type AudioDevice,
} from "~/sdk/audio-devices.js";
import { McpManager } from "~/sdk/mcp.js";
import { AudioRecorder } from "~/sdk/recorder.js";
import { TTSClient } from "~/sdk/tts.js";
import { MCP_CONFIG_PATH } from "../constants.js";
import type { ChatOptions, NarrationOptions, SpeakOptions } from "../types.js";

export type { AudioDevice };
export { listInputDevices, listOutputDevices };

const PROJECT_ROOT = path.resolve(process.cwd());
const TMP_DIR = path.join(PROJECT_ROOT, "tmp");
const INPUT_WAV = path.join(TMP_DIR, "input.wav");
const OUTPUT_WAV = path.join(TMP_DIR, "output.wav");

mkdirSync(TMP_DIR, { recursive: true });

const defaultTts = new TTSClient();
const defaultRecorder = new AudioRecorder();

/** Current afplay/aplay subprocess, if any. Killed on quit or when starting new playback. */
let currentPlayback: ReturnType<typeof spawn> | null = null;

/** Stops any in-flight TTS playback (afplay/aplay). Safe to call multiple times. */
export function stopAudioPlayback(): void {
  if (currentPlayback) {
    try {
      currentPlayback.kill();
    } catch {
      // process may already be gone
    }
    currentPlayback = null;
  }
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterModelInfo {
  id: string;
  name: string;
}

/** Fetches OpenRouter models that support text input and tools. Requires API key. */
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
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      const json = (await res.json()) as {
        data?: Array<{
          id?: string;
          name?: string;
          architecture?: {
            input_modalities?: string[];
          };
          supported_parameters?: string[];
        }>;
      };
      const list = json.data ?? [];
      return list
        .filter((m) => {
          const hasText =
            m.architecture?.input_modalities?.includes("text") ?? true;
          const hasTools = m.supported_parameters?.includes("tools") ?? false;
          return m.id && hasText && hasTools;
        })
        .map((m) => ({
          id: m.id!,
          name: m.name ?? m.id!,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    })(),
    toError,
  );
}

/** Creates an OpenRouter chat adapter (OpenAI-compatible API). Tools not yet supported. */
function createOpenRouterChat(
  model: string,
  apiKey: string,
): {
  name: "openrouter";
  model: string;
  chatStream: (opts: {
    messages: Array<{ role: string; content: string }>;
    request?: RequestInit;
  }) => AsyncIterable<{
    type: string;
    delta?: string;
    content?: string;
    error?: { message: string };
  }>;
} {
  return {
    name: "openrouter",
    model,
    async *chatStream({
      messages,
      request = {},
    }: {
      messages: Array<{ role: string; content: string }>;
      request?: RequestInit;
    }) {
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(request.headers as Record<string, string>),
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        yield {
          type: "RUN_ERROR",
          error: { message: `${res.status}: ${text}` },
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
                const json = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
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
                // skip malformed chunk
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

function getOllamaClient(baseUrl?: string): Ollama {
  const url = baseUrl?.trim() || DEFAULT_OLLAMA_URL;
  if (url === DEFAULT_OLLAMA_URL) return ollama as Ollama;
  return new Ollama({ host: url });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function listVoices(): ResultAsync<string[], Error> {
  return new TTSClient().listVoices();
}

export function listOllamaModels(
  baseUrl?: string,
): ResultAsync<string[], Error> {
  const client = getOllamaClient(baseUrl);
  return ResultAsync.fromPromise(
    client.list().then((res) => res.models.map((m) => m.name)),
    toError,
  );
}

export function speak(
  text: string,
  options: SpeakOptions = {},
): ResultAsync<void, Error> {
  const { voice = "af_bella", speed = 1.0, play = true } = options;
  const client = new TTSClient();
  return client
    .synthesize(text, { voice, speed })
    .andThen((audioData) =>
      ResultAsync.fromPromise(Bun.write(OUTPUT_WAV, audioData), toError).map(
        () => undefined as void,
      ),
    )
    .andTee(() => {
      if (!play) return;
      stopAudioPlayback();
      if (process.platform === "darwin") {
        currentPlayback = spawn(["afplay", OUTPUT_WAV], {
          stdout: "ignore",
          stderr: "ignore",
        });
      } else if (process.platform === "linux") {
        currentPlayback = spawn(["aplay", OUTPUT_WAV], {
          stdout: "ignore",
          stderr: "ignore",
        });
      }
    });
}

const NARRATION_SYSTEM = `You are a narrator. Given an assistant's reply that may contain code, tables, diagrams, or markdown, produce a short spoken version suitable for text-to-speech.
Rules: Output ONLY the narration, no preamble or "Here is the narration". Use plain language. Summarize or describe code blocks, tables, and diagrams instead of reading them verbatim. Keep the same meaning and tone.`;

/** One-shot OpenRouter chat (no stream). Returns content or throws. */
async function openRouterChat(
  model: string,
  apiKey: string,
  messages: Array<{ role: "system" | "user"; content: string }>,
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Converts raw assistant text into TTS-friendly narration (summarizes code/tables/diagrams). Uses same provider as chat (Ollama or OpenRouter). */
export function narrateResponse(
  rawResponse: string,
  options: NarrationOptions,
): ResultAsync<string, Error> {
  const {
    model,
    provider = "ollama",
    ollamaBaseUrl,
    openrouterApiKey,
  } = options;
  const messages = [
    { role: "system" as const, content: NARRATION_SYSTEM },
    { role: "user" as const, content: rawResponse },
  ];
  if (provider === "openrouter" && openrouterApiKey?.trim()) {
    return ResultAsync.fromPromise(
      openRouterChat(model, openrouterApiKey.trim(), messages),
      toError,
    );
  }
  const client = getOllamaClient(ollamaBaseUrl);
  return ResultAsync.fromPromise(
    client
      .chat({
        model,
        messages: [
          { role: "system", content: NARRATION_SYSTEM },
          { role: "user", content: rawResponse },
        ],
        stream: false,
      })
      .then((r) => r.message.content ?? ""),
    toError,
  );
}

/** One-shot chat with optional MCP tools. Supports Ollama and OpenRouter. Returns assistant text or null. */
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
  } = options;
  const mcp = new McpManager();

  const systemPrompts: string[] = explicitSystemPrompts ?? [];
  const priorWithoutSystem = priorMessages.filter((m) => m.role !== "system");
  const messages: ModelMessage<string>[] = [
    ...priorWithoutSystem.map(
      (m): ModelMessage<string> => ({
        role: m.role as ModelMessage["role"],
        content: m.content ?? "",
      }),
    ),
    { role: "user", content: prompt },
  ];

  return mcp
    .loadConfigAndGetStatuses(mcpConfigPath ?? MCP_CONFIG_PATH)
    .andThen(() => {
      if (provider === "openrouter") {
        const openRouterMessages: Array<{ role: string; content: string }> =
          systemPrompts.length > 0
            ? [
                { role: "system", content: systemPrompts.join("\n\n") },
                ...messages,
              ]
            : messages;
        const openRouterAdapter = createOpenRouterChat(
          model,
          openrouterApiKey ?? "",
        );
        return ResultAsync.fromPromise(
          (async () => {
            try {
              let finalContent = "";
              for await (const chunk of openRouterAdapter.chatStream({
                messages: openRouterMessages,
                request: abortController
                  ? { signal: abortController.signal }
                  : undefined,
              })) {
                if (abortController?.signal.aborted) {
                  const e = new Error("Chat was cancelled.");
                  (e as Error & { name: string }).name = "AbortError";
                  throw e;
                }
                if (chunk.type === "RUN_ERROR")
                  throw new Error(chunk.error?.message ?? "OpenRouter error");
                if (chunk.type === "content" && chunk.delta) {
                  finalContent += chunk.delta;
                  onUpdate?.(finalContent);
                }
              }
              if (abortController?.signal.aborted) {
                const e = new Error("Chat was cancelled.");
                (e as Error & { name: string }).name = "AbortError";
                throw e;
              }
              return finalContent || null;
            } finally {
              await mcp.close();
            }
          })(),
          toError,
        );
      }

      const tools = useTools ? mcp.getTanStackTools() : [];
      const ollamaAdapter = createOllamaChat(model, ollamaBaseUrl);
      return ResultAsync.fromPromise(
        (async () => {
          try {
            const stream = tanstackChat({
              adapter: ollamaAdapter,
              messages,
              ...(systemPrompts.length > 0 && { systemPrompts }),
              tools,
              ...(abortController && { abortController }),
            });

            let finalContent = "";
            for await (const chunk of stream) {
              if (abortController?.signal.aborted) {
                const e = new Error("Chat was cancelled.");
                (e as Error & { name: string }).name = "AbortError";
                throw e;
              }
              if (
                chunk.type === "content" ||
                chunk.type === "TEXT_MESSAGE_CONTENT"
              ) {
                const delta = "delta" in chunk ? chunk.delta : "";
                finalContent += delta;
                onUpdate?.(finalContent);
              } else if (
                chunk.type === "TOOL_CALL_START" &&
                "toolName" in chunk
              ) {
                onToolCall?.(chunk.toolName, "start");
              } else if (
                chunk.type === "TOOL_CALL_END" &&
                "toolName" in chunk
              ) {
                onToolCall?.(chunk.toolName, "end");
              } else if (chunk.type === "RUN_ERROR") {
                throw new Error(chunk.error.message);
              }
            }
            if (abortController?.signal.aborted) {
              const e = new Error("Chat was cancelled.");
              (e as Error & { name: string }).name = "AbortError";
              throw e;
            }
            return finalContent || null;
          } finally {
            await mcp.close();
          }
        })(),
        toError,
      );
    });
}

export interface RecordAndTranscribeOptions {
  deviceIndex?: number;
  recordSignal: AbortSignal;
}

/** Record from mic until signal is aborted, then transcribe. Returns transcript text (or ""). */
export function recordAndTranscribe(
  options: RecordAndTranscribeOptions,
): ResultAsync<string, Error> {
  const { deviceIndex = 0, recordSignal } = options;
  return defaultRecorder
    .record(INPUT_WAV, deviceIndex, { signal: recordSignal })
    .andThen(() => defaultTts.transcribe(INPUT_WAV))
    .map((t) => t?.trim() ?? "");
}
