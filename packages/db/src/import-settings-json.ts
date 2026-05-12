import { existsSync, readFileSync } from "node:fs";

import type { YapprDb } from "./client.js";

export type ImportResult =
  | { kind: "imported"; count: number }
  | { kind: "skipped"; reason: "already-populated" | "no-file" | "corrupt" };

/**
 * One-way migration from the CLI's legacy `~/.yappr/settings.json` into the
 * preferences table. Runs only when the DB is empty — never overwrites
 * existing rows. The JSON file is left in place untouched.
 *
 * Synchronous: this is a single small file read that runs at most once per
 * DB instance, so we keep it sync to avoid racing concurrent reads through
 * the preferences repo. Idempotent — safe to call on every app start.
 */
export function importSettingsJsonIfFresh(
  db: YapprDb,
  settingsPath: string,
): ImportResult {
  if (db.preferences.count() > 0) {
    return { kind: "skipped", reason: "already-populated" };
  }
  if (!existsSync(settingsPath)) {
    return { kind: "skipped", reason: "no-file" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    return { kind: "skipped", reason: "corrupt" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "skipped", reason: "corrupt" };
  }

  const entries = parsed as Record<string, unknown>;
  db.preferences.setMany(entries);
  return { kind: "imported", count: Object.keys(entries).length };
}
