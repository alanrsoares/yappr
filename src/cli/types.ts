export type ScreenId =
  | "menu"
  | "mcp"
  | "speak"
  | "chat"
  | "voices"
  | "settings";

/** Chat model provider. */
export type ChatProvider = "ollama" | "openrouter";

export interface Preferences {
  /** Ollama API base URL (e.g. http://localhost:11434). */
  ollamaBaseUrl: string;
  /** Path to MCP config JSON (e.g. ~/.cursor/mcp.json). */
  mcpConfigPath: string;
  /** Chat provider (ollama or openrouter). */
  defaultChatProvider: ChatProvider;
  /** Model name for the selected provider (e.g. qwen2.5:14b for Ollama, openai/gpt-4o for OpenRouter). */
  defaultChatModel: string;
  /** @deprecated Use defaultChatProvider + defaultChatModel. Kept for migration. */
  defaultOllamaModel?: string;
  defaultVoice: string;
  defaultInputDeviceIndex: number;
  defaultOutputDeviceIndex: number;
  /** When true, a separate model step turns the response into TTS-friendly narration (no code/tables verbatim). */
  useNarrationForTTS: boolean;
  /** Model used for narration (Ollama model name). If unset and useNarrationForTTS is true, the chat model is used. */
  narrationModel: string;
  /** OpenRouter API key (required when defaultChatProvider is openrouter). */
  openrouterApiKey: string;
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

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  play?: boolean;
}

export interface ChatOptions {
  /** Provider (defaults to ollama). */
  provider?: ChatProvider;
  /** Model name for the selected provider. */
  model?: string;
  /** Ollama server base URL (e.g. http://localhost:11434). Only used when provider is ollama. */
  ollamaBaseUrl?: string;
  /** OpenRouter API key. Only used when provider is openrouter. */
  openrouterApiKey?: string;
  /** Path to MCP config JSON. */
  mcpConfigPath?: string;
  useTools?: boolean;
  onUpdate?: (content: string) => void;
  /** Prior conversation messages for multi-turn chat (user/assistant only; system use systemPrompts). */
  messages?: ChatMessage[];
  /** System prompt(s) sent as system context. Prefer over putting system in messages. */
  systemPrompts?: string[];
  /** AbortController to cancel in-flight chat. */
  abortController?: AbortController;
  /** Called when an MCP tool call starts or ends (for UI status). */
  onToolCall?: (name: string, phase: "start" | "end") => void;
}

export interface NarrationOptions {
  model: string;
  /** Same as chat: ollama vs openrouter. When omitted, defaults to ollama for backwards compatibility. */
  provider?: ChatProvider;
  /** Ollama server base URL (used when provider is ollama). */
  ollamaBaseUrl?: string;
  /** OpenRouter API key (used when provider is openrouter). */
  openrouterApiKey?: string;
}
