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
  NarrationOptions,
  SpeakOptions,
} from "../types.js";

export type { AudioDevice };
export { listInputDevices, listOutputDevices };

const PROJECT_ROOT = path.resolve(process.cwd());
const INPUT_WAV = path.join(PROJECT_ROOT, "input.wav");
const OUTPUT_WAV = path.join(PROJECT_ROOT, "output.wav");

const defaultTts = new KittenTTSClient();
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

/** Converts raw assistant text into TTS-friendly narration (summarizes code/tables/diagrams). */
export function narrateResponse(
  rawResponse: string,
  options: NarrationOptions,
): ResultAsync<string, Error> {
  const { model } = options;
  return ResultAsync.fromPromise(
    ollama.chat({
      model,
      messages: [
        { role: "system", content: NARRATION_SYSTEM },
        { role: "user", content: rawResponse },
      ],
      stream: false,
    }).then((r) => r.message.content ?? ""),
    toError,
  );
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

/** One listen cycle: record → transcribe → chat → [narrate] → speak. */
export function runListenStep(
  options: ListenStepOptions = {},
): ResultAsync<ListenStepResult, Error> {
  const {
    deviceIndex = 0,
    model = "qwen2.5:14b",
    voice = "af_bella",
    recordSignal,
    useNarrationForTTS = false,
    narrationModel,
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
      return chat(transcript, { model }).andThen((response) => {
        if (!response) {
          return okAsync<ListenStepResult, Error>({ transcript, response: null });
        }
        const modelForNarration = narrationModel || model;
        if (useNarrationForTTS && modelForNarration) {
          return narrateResponse(response, { model: modelForNarration })
            .map((narration) => narration.trim() || response)
            .andThen((toSpeak) =>
              speak(toSpeak, { voice }).map(() => ({
                transcript,
                response,
              })),
            );
        }
        return speak(response, { voice }).map(() => ({
          transcript,
          response,
        }));
      });
    },
  );
}
