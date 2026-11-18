import { resolveMcpConfigPath } from "@yappr/sdk/paths";

import type { ScreenId } from "./types.js";

/**
 * Default MCP config path. Resolved via cascade:
 *   `YAPPR_MCP_CONFIG` env → `~/.config/yappr/mcp.json` → `~/.cursor/mcp.json` → neutral fallback.
 * Computed once at module load; user preferences override this at runtime.
 */
export const MCP_CONFIG_PATH = resolveMcpConfigPath();

export const DEFAULT_KEYS = {
  quit: ["q"],
  refresh: ["r", "R"],
  back: ["escape"],
} as const;

export const wantsBackKey = (effectiveKey: string) =>
  (DEFAULT_KEYS.back as readonly string[]).includes(effectiveKey);

export const MENU_ITEMS: Array<{
  id: ScreenId;
  label: string;
  description: string;
  group: "core" | "config";
}> = [
  {
    id: "chat",
    label: "Chat",
    description: "Interactive chat & voice mode",
    group: "core",
  },
  {
    id: "speak",
    label: "Speak",
    description: "One-shot text to speech",
    group: "core",
  },
  {
    id: "voices",
    label: "Voices",
    description: "Browse & preview TTS voices",
    group: "core",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Models, speech endpoint & devices",
    group: "config",
  },
  {
    id: "mcp",
    label: "MCP servers",
    description: "Inspect tool server connections",
    group: "config",
  },
  {
    id: "setup",
    label: "Setup wizard",
    description: "Check deps, server & defaults",
    group: "config",
  },
];

export { userHomeDir } from "@yappr/sdk/paths";
