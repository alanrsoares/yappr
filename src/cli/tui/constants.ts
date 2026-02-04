export const MCP_CONFIG_PATH = `${process.env.HOME ?? ""}/.cursor/mcp.json`;

export const DEFAULT_KEYS = {
  quit: ["q", "escape"],
  refresh: ["r", "R"],
  back: ["b", "escape"],
} as const;

export type ScreenId =
  | "menu"
  | "mcp"
  | "speak"
  | "chat"
  | "listen"
  | "voices";

export const MENU_ITEMS: { id: ScreenId; label: string }[] = [
  { id: "mcp", label: "MCP servers" },
  { id: "speak", label: "Speak (text → speech)" },
  { id: "chat", label: "Chat (prompt → Ollama + TTS)" },
  { id: "listen", label: "Listen (voice → transcribe → chat → TTS)" },
  { id: "voices", label: "List voices" },
];
