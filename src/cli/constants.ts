import os from "node:os";
import path from "node:path";

import type { ScreenId } from "./types.js";

/** Prefer env (tests patch `HOME`; Windows uses `USERPROFILE`), then `os.homedir()`. */
export function userHomeDir(): string {
  if (process.env.HOME) return process.env.HOME;
  if (process.env.USERPROFILE) return process.env.USERPROFILE;
  return os.homedir();
}

export const MCP_CONFIG_PATH = path.join(userHomeDir(), ".cursor", "mcp.json");

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
