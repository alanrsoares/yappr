/**
 * Shared yappr actions for the TUI (and optionally CLI). Uses SDK + Ollama.
 * Public async API returns ResultAsync for consistent, functional error handling.
 */
import path from "path";
import { spawn } from "bun";
import ollama, { type Tool as OllamaTool } from "ollama";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

import { AudioManager, type AudioDevice } from "~/sdk/audio-manager.js";
import { McpManager } from "~/sdk/mcp.js";
import { AudioRecorder } from "~/sdk/recorder.js";
import { KittenTTSClient } from "~/sdk/tts.js";

const PROJECT_ROOT = path.resolve(process.cwd());
const INPUT_WAV = path.join(PROJECT_ROOT, "input.wav");
const OUTPUT_WAV = path.join(PROJECT_ROOT, "output.wav");

const defaultTts = new KittenTTSClient();
const defaultRecorder = new AudioRecorder();
const defaultAudioManager = new AudioManager();

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ListenStepResult {
  transcript: string;
  response: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function listVoices(): ResultAsync<string[], Error> {
  return new KittenTTSClient().listVoices();
}

export function listDevices(): ResultAsync<AudioDevice[], Error> {
  return defaultAudioManager.listDevices();
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  play?: boolean;
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

export interface ChatOptions {
  model?: string;
  useTools?: boolean;
}

/** One-shot Ollama chat with optional MCP tools. Returns assistant text or null. */
export function chat(
  prompt: string,
  options: ChatOptions = {},
): ResultAsync<string | null, Error> {
  const { model = "qwen2.5:14b", useTools = true } = options;
  const mcp = new McpManager();
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];

  const getTools = useTools
    ? mcp.loadConfigAndGetStatuses().map(() => mcp.getOllamaTools())
    : okAsync<OllamaTool[], Error>([]);

  return getTools
    .andThen((tools) =>
      ResultAsync.fromPromise(
        runChatLoop(mcp, model, messages, tools),
        toError,
      ),
    )
    .orElse((e) =>
      useTools &&
      e instanceof Error &&
      e.message.includes("does not support tools")
        ? chat(prompt, { ...options, useTools: false })
        : errAsync(e),
    );
}

async function runChatLoop(
  mcp: McpManager,
  model: string,
  messages: ChatMessage[],
  tools: OllamaTool[],
): Promise<string | null> {
  while (true) {
    const response = await ollama.chat({
      model,
      messages,
      stream: false,
      tools: tools.length > 0 ? tools : undefined,
    });

    const message = response.message;
    messages.push({
      role: message.role ?? "assistant",
      content: message.content ?? "",
    });

    if (message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        const name = call.function.name;
        const rawArgs = call.function.arguments;
        const args =
          typeof rawArgs === "string"
            ? (JSON.parse(rawArgs || "{}") as Record<string, unknown>)
            : (rawArgs as Record<string, unknown>);
        const toolResult = await mcp.callTool(name, args);
        toolResult.match(
          (result) => {
            messages.push({
              role: "tool",
              content: JSON.stringify(
                Array.isArray(result?.content) ? result.content : result,
              ),
            });
          },
          (err) => {
            messages.push({
              role: "tool",
              content: `Error: ${err.message}`,
            });
          },
        );
      }
    } else {
      await mcp.close();
      return message.content ?? null;
    }
  }
}

export interface ListenStepOptions {
  deviceIndex?: number;
  model?: string;
  voice?: string;
  recordSignal?: AbortSignal;
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
    return errAsync(
      new Error("recordSignal (AbortSignal) required for TUI"),
    );
  }

  return defaultRecorder
    .record(INPUT_WAV, deviceIndex, { signal: recordSignal })
    .andThen(() => defaultTts.transcribe(INPUT_WAV))
    .andThen((transcript) => {
      if (!transcript?.trim() || transcript.length < 2) {
        return okAsync<ListenStepResult, Error>({ transcript, response: null });
      }
      return chat(transcript, { model }).andThen((response) =>
        response
          ? speak(response, { voice }).map(() => ({
              transcript,
              response,
            }))
          : okAsync<ListenStepResult, Error>({ transcript, response: null }),
      );
    });
}
