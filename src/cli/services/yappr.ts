/**
 * Shared yappr actions for the TUI (and optionally CLI). Uses SDK + Ollama.
 */
import path from "path";
import { spawn } from "bun";
import ollama, { type Tool as OllamaTool } from "ollama";

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

export async function listVoices(): Promise<string[]> {
  const client = new KittenTTSClient();
  return await client.listVoices().match((v) => v, (e) => {
    throw e;
  });
}

export async function listDevices(): Promise<AudioDevice[]> {
  return await defaultAudioManager.listDevices().match((v) => v, (e) => {
    throw e;
  });
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  play?: boolean;
}

export async function speak(
  text: string,
  options: SpeakOptions = {},
): Promise<void> {
  const { voice = "af_bella", speed = 1.0, play = true } = options;
  const client = new KittenTTSClient();
  const result = await client.synthesize(text, { voice, speed });
  if (result.isErr()) throw result.error;
  await Bun.write(OUTPUT_WAV, result.value);
  if (play && process.platform === "darwin") {
    spawn(["afplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
  } else if (play && process.platform === "linux") {
    spawn(["aplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
  }
}

export interface ChatOptions {
  model?: string;
  useTools?: boolean;
}

/** One-shot Ollama chat with optional MCP tools. Returns assistant text or null. */
export async function chat(
  prompt: string,
  options: ChatOptions = {},
): Promise<string | null> {
  const { model = "qwen2.5:14b", useTools = true } = options;
  const mcp = new McpManager();
  let tools: OllamaTool[] = [];

  if (useTools) {
    await mcp.loadConfigAndGetStatuses();
    tools = mcp.getOllamaTools();
  }

  const messages: ChatMessage[] = [{ role: "user", content: prompt }];

  try {
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
        const text = message.content ?? null;
        await mcp.close();
        return text;
      }
    }
  } catch (error) {
    await mcp.close();
    if (
      useTools &&
      error instanceof Error &&
      error.message.includes("does not support tools")
    ) {
      return chat(prompt, { ...options, useTools: false });
    }
    throw error;
  }
}

export interface ListenStepOptions {
  deviceIndex?: number;
  model?: string;
  voice?: string;
  recordSignal?: AbortSignal;
}

/** One listen cycle: record (until signal aborted) → transcribe → chat → speak. */
export async function runListenStep(
  options: ListenStepOptions = {},
): Promise<ListenStepResult> {
  const {
    deviceIndex = 0,
    model = "qwen2.5:14b",
    voice = "af_bella",
    recordSignal,
  } = options;

  if (!recordSignal) {
    throw new Error("recordSignal (AbortSignal) required for TUI");
  }

  const recordResult = await defaultRecorder.record(INPUT_WAV, deviceIndex, {
    signal: recordSignal,
  });
  if (recordResult.isErr()) {
    return {
      transcript: "",
      response: null,
      error: recordResult.error.message,
    };
  }

  const transcriptResult = await defaultTts.transcribe(INPUT_WAV);
  if (transcriptResult.isErr()) {
    return {
      transcript: "",
      response: null,
      error: transcriptResult.error.message,
    };
  }
  const transcript = transcriptResult.value;
  if (!transcript?.trim() || transcript.length < 2) {
    return { transcript, response: null };
  }

  try {
    const response = await chat(transcript, { model });
    if (response) {
      await speak(response, { voice });
    }
    return { transcript, response };
  } catch (err) {
    return {
      transcript: "",
      response: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
