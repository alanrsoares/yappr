import path from "node:path";
import { createDb, importSettingsJsonIfFresh, type YapprDb } from "@yappr/db";

import { userHomeDir } from "../constants.js";

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

const getDbPath = (): string => path.join(userHomeDir(), YAPPR_DIR, DB_FILE);

const getLegacySettingsPath = (): string =>
  path.join(userHomeDir(), YAPPR_DIR, LEGACY_SETTINGS_FILE);

/**
 * Open (or reuse) the shared Yappr SQLite DB at `~/.yappr/yappr.db`. First
 * caller in the process triggers a one-shot legacy `settings.json` import,
 * then every consumer (preferences, chat persistence, future surfaces) reads
 * from the same handle.
 */
export function getDb(): YapprDb {
  const dbPath = getDbPath();
  const cached = dbCache.get(dbPath);
  if (cached) return cached;

  const db = createDb({ path: dbPath });
  importSettingsJsonIfFresh(db, getLegacySettingsPath());
  dbCache.set(dbPath, db);
  return db;
}
