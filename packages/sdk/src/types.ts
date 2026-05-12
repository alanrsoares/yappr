export interface AudioDevice {
  index: number;
  name: string;
}

export interface RecordOptions {
  signal?: AbortSignal;
}

export type { TTSOptions } from "./tts.js";

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  name?: string;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export type TransportKind = "stdio" | "streamable-http" | "sse";

export interface ServerStatus {
  id: string;
  status: "[OK] Connected" | "[FAIL] Failed" | "[SKIP] Skipped";
  tools: number;
  message: string;
  transport?: TransportKind;
}
