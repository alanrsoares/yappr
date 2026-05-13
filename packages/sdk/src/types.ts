export interface AudioDevice {
  index: number;
  name: string;
}

export interface RecordOptions {
  signal?: AbortSignal;
}

export type { TTSOptions } from "./tts.js";

export type { McpConfig, McpServerConfig } from "./schemas.js";

export type TransportKind = "stdio" | "streamable-http" | "sse";

export interface ServerStatus {
  id: string;
  status: "[OK] Connected" | "[FAIL] Failed" | "[SKIP] Skipped";
  tools: number;
  message: string;
  transport?: TransportKind;
}
