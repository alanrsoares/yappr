import { toError } from "@yappr/lib/result";
import { DEFAULT_VOICE, DEFAULT_VOICE_CONFIG } from "@yappr/sdk/defaults";
import { Effect } from "effect";

import { MCP_CONFIG_PATH } from "../constants.js";
import type { Preferences } from "../types.js";
import { getDb } from "./db.js";
import { mergeStoredPreferences } from "./preferences-merge.js";

export const DEFAULT_PREFERENCES: Preferences = {
  ollamaBaseUrl: "http://localhost:11434",
  mcpConfigPath: MCP_CONFIG_PATH,
  defaultChatProvider: "ollama",
  defaultChatModel: "qwen2.5:14b",
  defaultVoice: DEFAULT_VOICE,
  defaultInputDeviceIndex: 0,
  defaultOutputDeviceIndex: 0,
  openrouterApiKey: "",
  voice: DEFAULT_VOICE_CONFIG,
  voiceReference: null,
  firstRunCompleted: false,
};

/**
 * Read all preferences from the DB and merge with defaults. Validation is
 * per-field — invalid values fall back to defaults silently.
 */
export function loadPreferences(): Effect.Effect<Preferences, Error> {
  return Effect.try({
    try: () => {
      const db = getDb();
      const stored = db.preferences.getAll();
      return mergeStoredPreferences(stored, DEFAULT_PREFERENCES);
    },
    catch: toError,
  });
}

/**
 * Write a partial preferences update. Only the supplied keys are touched;
 * other rows in the DB are left intact (no full-row read-modify-write needed).
 */
export function savePreferences(
  partial: Partial<Preferences>,
): Effect.Effect<void, Error> {
  return Effect.try({
    try: () => {
      const db = getDb();
      db.preferences.setMany(partial as Record<string, unknown>);
    },
    catch: toError,
  });
}
