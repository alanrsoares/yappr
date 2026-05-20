import { toError } from "@yappr/lib/result";
import { DEFAULT_VOICE } from "@yappr/sdk/defaults";
import { ResultAsync } from "neverthrow";

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
  useNarrationForTTS: false,
  narrationModel: "",
  openrouterApiKey: "",
  firstRunCompleted: false,
};

/**
 * Read all preferences from the DB, merge with defaults, and apply the legacy
 * `defaultOllamaModel` migration. Same `Preferences` contract as the previous
 * JSON-file implementation — `mergeStoredPreferences` does the validation +
 * legacy handling unchanged.
 */
export function loadPreferences(): ResultAsync<Preferences, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const db = getDb();
      const stored = db.preferences.getAll();
      return mergeStoredPreferences(stored, DEFAULT_PREFERENCES);
    })(),
    toError,
  );
}

/**
 * Write a partial preferences update. Only the supplied keys are touched;
 * other rows in the DB are left intact (no full-row read-modify-write needed).
 */
export function savePreferences(
  partial: Partial<Preferences>,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const db = getDb();
      db.preferences.setMany(partial as Record<string, unknown>);
    })(),
    toError,
  );
}
