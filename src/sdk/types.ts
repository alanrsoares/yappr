import type { components } from "./schema.js";

export interface AudioDevice {
  index: number;
  name: string;
}

export interface RecordOptions {
  /** When aborted, recording stops. Use for TUI (e.g. Enter to stop) instead of stdin. */
  signal?: AbortSignal;
}

export type TTSOptions = Partial<components["schemas"]["SynthesizeRequest"]>;

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
  /** Set when connected via URL; indicates whether server supports Streamable HTTP or legacy SSE. */
  transport?: TransportKind;
}
