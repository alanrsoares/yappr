import path from "node:path";
import { createDb, importSettingsJsonIfFresh, type YapprDb } from "@yappr/db";
import { toError } from "@yappr/lib/result";
import { DEFAULT_VOICE } from "@yappr/sdk/defaults";
import { ResultAsync } from "neverthrow";

import { MCP_CONFIG_PATH, userHomeDir } from "../constants.js";
import type { Preferences } from "../types.js";
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
};

const YAPPR_DIR = ".yappr";
const DB_FILE = "yappr.db";
const LEGACY_SETTINGS_FILE = "settings.json";

/**
 * Cache DB handles by resolved file path. bun:sqlite holds an OS lock on the
 * file, so we open at most one Database per path. Tests that swap `HOME`
 * between cases get distinct cache entries automatically; the previous
 * (orphaned) handle still works against its now-deleted file but is harmless.
 */
const dbCache = new Map<string, YapprDb>();

function getDbPath(): string {
  return path.join(userHomeDir(), YAPPR_DIR, DB_FILE);
}

function getLegacySettingsPath(): string {
  return path.join(userHomeDir(), YAPPR_DIR, LEGACY_SETTINGS_FILE);
}

function getDb(): YapprDb {
  const dbPath = getDbPath();
  const cached = dbCache.get(dbPath);
  if (cached) return cached;

  const db = createDb({ path: dbPath });
  // One-way import from the CLI's pre-DB settings.json. Idempotent + sync,
  // so subsequent reads from the same `getDb()` see the migrated rows.
  importSettingsJsonIfFresh(db, getLegacySettingsPath());
  dbCache.set(dbPath, db);
  return db;
}

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
