export type ScreenId =
  | "menu"
  | "mcp"
  | "speak"
  | "chat"
  | "listen"
  | "voices"
  | "settings";

export interface Preferences {
  /** Ollama API base URL (e.g. http://localhost:11434). */
  ollamaBaseUrl: string;
  /** Path to MCP config JSON (e.g. ~/.cursor/mcp.json). */
  mcpConfigPath: string;
  defaultOllamaModel: string;
  defaultVoice: string;
  defaultInputDeviceIndex: number;
  defaultOutputDeviceIndex: number;
  /** When true, a separate model step turns the response into TTS-friendly narration (no code/tables verbatim). */
  useNarrationForTTS: boolean;
  /** Model used for narration. If unset and useNarrationForTTS is true, the chat model is used. */
  narrationModel: string;
}

export interface MenuItem {
  id: string;
  label: string;
}

export interface SummaryCounts {
  connected: number;
  failed: number;
  skipped: number;
  totalTools: number;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ListenStepResult {
  transcript: string;
  response: string | null;
  error?: string;
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  play?: boolean;
}

export interface ChatOptions {
  model?: string;
  /** Ollama server base URL (e.g. http://localhost:11434). */
  ollamaBaseUrl?: string;
  /** Path to MCP config JSON. */
  mcpConfigPath?: string;
  useTools?: boolean;
  onUpdate?: (content: string) => void;
  /** Prior conversation messages for multi-turn chat. */
  messages?: ChatMessage[];
}

export interface ListenStepOptions {
  deviceIndex?: number;
  model?: string;
  voice?: string;
  recordSignal?: AbortSignal;
  ollamaBaseUrl?: string;
  useNarrationForTTS?: boolean;
  narrationModel?: string;
}

export interface NarrationOptions {
  model: string;
  /** Ollama server base URL. */
  ollamaBaseUrl?: string;
}
