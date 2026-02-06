import type { ScreenId } from "./types.js";

export const MCP_CONFIG_PATH = `${process.env.HOME ?? ""}/.cursor/mcp.json`;

export const DEFAULT_KEYS = {
  quit: ["q", "escape"],
  refresh: ["r", "R"],
  back: ["escape"],
} as const;

export const MENU_ITEMS: { id: ScreenId; label: string }[] = [
  { id: "mcp", label: "MCP servers" },
  { id: "speak", label: "Speak (text → speech)" },
  { id: "chat", label: "Chat (interactive + voice mode)" },
  { id: "voices", label: "List voices" },
  { id: "settings", label: "Settings" },
];
