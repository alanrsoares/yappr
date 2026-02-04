/**
 * Shared yappr actions for the TUI (and optionally CLI). Uses SDK + Ollama.
 */
import { spawn } from "bun";
import path from "path";
import { KittenTTSClient } from "../../../sdk/tts.js";
import { AudioRecorder } from "../../../sdk/recorder.js";
import { AudioManager } from "../../../sdk/audio_manager.js";
import { McpManager } from "../../../sdk/mcp.js";

const PROJECT_ROOT = path.resolve(process.cwd());
const INPUT_WAV = path.join(PROJECT_ROOT, "input.wav");
const OUTPUT_WAV = path.join(PROJECT_ROOT, "output.wav");

const defaultTts = new KittenTTSClient();
const defaultRecorder = new AudioRecorder();
const defaultAudioManager = new AudioManager();

export async function listVoices(): Promise<string[]> {
  const client = new KittenTTSClient();
  return client.listVoices();
}

export async function listDevices(): Promise<{ index: number; name: string }[]> {
  return defaultAudioManager.listDevices();
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  play?: boolean;
}

export async function speak(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  const { voice = "af_bella", speed = 1.0, play = true } = options;
  const client = new KittenTTSClient();
  const audioData = await client.synthesize(text, { voice, speed });
  await Bun.write(OUTPUT_WAV, audioData);
  if (play && process.platform === "darwin") {
    spawn(["afplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
  } else if (play && process.platform === "linux") {
    spawn(["aplay", OUTPUT_WAV], { stdout: "ignore", stderr: "ignore" });
  }
}

export interface ChatOptions {
  model?: string;
  voice?: string;
  useTools?: boolean;
}

/** One-shot Ollama chat with optional MCP tools. Returns assistant text or null. */
export async function chat(
  prompt: string,
  options: ChatOptions = {}
): Promise<string | null> {
  const { model = "qwen2.5:14b", voice = "af_bella", useTools = true } = options;
  const mcp = new McpManager();
  let tools: unknown[] = [];

  if (useTools) {
    await mcp.loadConfigAndGetStatuses();
    tools = mcp.getOllamaTools();
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "user", content: prompt },
  ];

  try {
    while (true) {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          tools: tools.length > 0 ? tools : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes("does not support tools") && useTools) {
          await mcp.close();
          return chat(prompt, { ...options, useTools: false });
        }
        throw new Error(`Ollama: ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as {
        message: {
          content?: string;
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
      };
      const message = data.message;
      messages.push(message as { role: string; content: string });

      if (message.tool_calls?.length) {
        for (const call of message.tool_calls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments || "{}");
          try {
            const result = await mcp.callTool(name, args);
            messages.push({
              role: "tool",
              content: JSON.stringify(
                Array.isArray(result?.content) ? result.content : result
              ),
            });
          } catch (err) {
            messages.push({
              role: "tool",
              content: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
            });
          }
        }
      } else {
        const text = message.content ?? null;
        await mcp.close();
        return text;
      }
    }
  } catch (error) {
    await mcp.close();
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
  options: ListenStepOptions = {}
): Promise<{ transcript: string; response: string | null; error?: string }> {
  const {
    deviceIndex = 0,
    model = "qwen2.5:14b",
    voice = "af_bella",
    recordSignal,
  } = options;

  if (!recordSignal) {
    throw new Error("recordSignal (AbortSignal) required for TUI");
  }

  await defaultRecorder.record(INPUT_WAV, deviceIndex, { signal: recordSignal });

  try {
    const transcript = await defaultTts.transcribe(INPUT_WAV);
    if (!transcript?.trim() || transcript.length < 2) {
      return { transcript, response: null };
    }
    const response = await chat(transcript, { model, voice });
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
