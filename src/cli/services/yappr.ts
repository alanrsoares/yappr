/**
 * Shared yappr actions for the TUI (and optionally CLI). Uses SDK + Ollama.
 * Public async API returns ResultAsync for consistent, functional error handling.
 */
import path from "path";
import { chat as tanstackChat, type ModelMessage } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { spawn } from "bun";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import ollama from "ollama";

import {
  listInputDevices,
  listOutputDevices,
  type AudioDevice,
} from "~/sdk/audio-devices.js";
import { McpManager } from "~/sdk/mcp.js";
import { AudioRecorder } from "~/sdk/recorder.js";
import { KittenTTSClient } from "~/sdk/tts.js";
import type {
  ChatOptions,
  ListenStepOptions,
  ListenStepResult,
  SpeakOptions,
} from "../types.js";

export type { AudioDevice };
export { listInputDevices, listOutputDevices };

const PROJECT_ROOT = path.resolve(process.cwd());
const INPUT_WAV = path.join(PROJECT_ROOT, "input.wav");
const OUTPUT_WAV = path.join(PROJECT_ROOT, "output.wav");

const defaultTts = new KittenTTSClient();
const defaultRecorder = new AudioRecorder();

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function listVoices(): ResultAsync<string[], Error> {
  return new KittenTTSClient().listVoices();
}

export function listOllamaModels(): ResultAsync<string[], Error> {
  return ResultAsync.fromPromise(
    ollama.list().then((res) => res.models.map((m) => m.name)),
    toError,
  );
}

export function speak(
  text: string,
  options: SpeakOptions = {},
): ResultAsync<void, Error> {
  const { voice = "af_bella", speed = 1.0, play = true } = options;
  const client = new KittenTTSClient();
  return client
    .synthesize(text, { voice, speed })
    .andThen((audioData) =>
      ResultAsync.fromPromise(Bun.write(OUTPUT_WAV, audioData), toError).map(
        () => undefined as void,
      ),
    )
    .andTee(() => {
      if (play && process.platform === "darwin") {
        spawn(["afplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
      } else if (play && process.platform === "linux") {
        spawn(["aplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
      }
    });
}

/** One-shot Ollama chat with optional MCP tools. Returns assistant text or null. */
export function chat(
  prompt: string,
  options: ChatOptions = {},
): ResultAsync<string | null, Error> {
  const {
    model = "qwen2.5:14b",
    useTools = true,
    onUpdate,
    messages: priorMessages = [],
  } = options;
  const mcp = new McpManager();

  const messages: ModelMessage<string>[] = [
    ...priorMessages.map(
      (m): ModelMessage<string> => ({
        role: (m.role === "system" ? "user" : m.role) as ModelMessage["role"],
        content: m.content ?? "",
      }),
    ),
    { role: "user", content: prompt },
  ];

  return mcp.loadConfigAndGetStatuses().andThen(() => {
    const tools = useTools ? mcp.getTanStackTools() : [];

    return ResultAsync.fromPromise(
      (async () => {
        try {
          const stream = tanstackChat({
            adapter: createOllamaChat(model),
            messages: messages,
            tools,
          });

          let finalContent = "";
          for await (const chunk of stream) {
            if (chunk.type === "content") {
              finalContent += chunk.delta;
              onUpdate?.(finalContent);
            } else if (chunk.type === "RUN_ERROR") {
              throw new Error(chunk.error.message);
            }
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

/** One listen cycle: record → transcribe → chat → speak. */
export function runListenStep(
  options: ListenStepOptions = {},
): ResultAsync<ListenStepResult, Error> {
  const {
    deviceIndex = 0,
    model = "qwen2.5:14b",
    voice = "af_bella",
    recordSignal,
  } = options;

  if (!recordSignal) {
    return errAsync(new Error("recordSignal (AbortSignal) required for TUI"));
  }

  return recordAndTranscribe({ deviceIndex, recordSignal }).andThen(
    (transcript) => {
      if (!transcript || transcript.length < 2) {
        return okAsync<ListenStepResult, Error>({
          transcript,
          response: null,
        });
      }
      return chat(transcript, { model }).andThen((response) =>
        response
          ? speak(response, { voice }).map(() => ({
              transcript,
              response,
            }))
          : okAsync<ListenStepResult, Error>({ transcript, response: null }),
      );
    },
  );
}
