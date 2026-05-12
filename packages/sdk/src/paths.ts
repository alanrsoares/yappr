import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Prefer env (tests patch `HOME`; Windows uses `USERPROFILE`), then `os.homedir()`. */
export function userHomeDir(): string {
  if (process.env.HOME) return process.env.HOME;
  if (process.env.USERPROFILE) return process.env.USERPROFILE;
  return os.homedir();
}

/**
 * Known MCP config locations. `yappr` is the neutral default;
 * `cursor` is auto-discovered for users coming from Cursor.
 */
export const MCP_CONFIG_PRESETS = {
  yappr: (): string => path.join(userHomeDir(), ".config", "yappr", "mcp.json"),
  cursor: (): string => path.join(userHomeDir(), ".cursor", "mcp.json"),
} as const;

/**
 * Resolve the MCP config path with this cascade:
 *   1. `YAPPR_MCP_CONFIG` env var (explicit override)
 *   2. First existing preset (`~/.config/yappr/mcp.json` → `~/.cursor/mcp.json`)
 *   3. Neutral `~/.config/yappr/mcp.json` (final fallback; may not exist)
 *
 * User preferences `mcpConfigPath` (settings.json) override this default when set.
 */
export function resolveMcpConfigPath(): string {
  const override = process.env.YAPPR_MCP_CONFIG?.trim();
  if (override) return override;

  const yappr = MCP_CONFIG_PRESETS.yappr();
  if (fs.existsSync(yappr)) return yappr;

  const cursor = MCP_CONFIG_PRESETS.cursor();
  if (fs.existsSync(cursor)) return cursor;

  return yappr;
}
