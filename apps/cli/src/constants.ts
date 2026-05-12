import { resolveMcpConfigPath, userHomeDir } from "@yappr/sdk/paths";

import type { ScreenId } from "./types.js";

export { userHomeDir };

/**
 * Default MCP config path. Resolved via cascade:
 *   `YAPPR_MCP_CONFIG` env → `~/.config/yappr/mcp.json` → `~/.cursor/mcp.json` → neutral fallback.
 * Computed once at module load; user preferences override this at runtime.
 */
export const MCP_CONFIG_PATH = resolveMcpConfigPath();

export const DEFAULT_KEYS = {
  quit: ["q", "escape"],
  refresh: ["r", "R"],
  back: ["escape"],
} as const;

export function wantsBackKey(effectiveKey: string) {
  return (DEFAULT_KEYS.back as readonly string[]).includes(effectiveKey);
}

export const MENU_ITEMS: { id: ScreenId; label: string }[] = [
  { id: "mcp", label: "MCP servers" },
  { id: "speak", label: "Speak (text → speech)" },
  { id: "chat", label: "Chat (interactive + voice mode)" },
  { id: "voices", label: "List voices" },
  { id: "settings", label: "Settings" },
];
