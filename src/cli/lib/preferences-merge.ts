import type { Preferences } from "../types.js";
import {
  type PreferencesJsonPartial,
  parsePreferencesJson,
} from "./preferences-schema.js";

function asRecord(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

function applyLegacyOllamaMigration(
  prefs: Preferences,
  partial: PreferencesJsonPartial,
  raw: Record<string, unknown>,
): Preferences {
  const legacyModel = partial.defaultOllamaModel;
  const shouldMigrate =
    typeof legacyModel === "string" &&
    legacyModel !== "" &&
    !Object.hasOwn(raw, "defaultChatModel") &&
    !Object.hasOwn(raw, "defaultChatProvider");

  if (!shouldMigrate) return prefs;

  return {
    ...prefs,
    defaultChatProvider: "ollama",
    defaultChatModel: legacyModel,
  };
}

/**
 * Parse stored settings JSON: merge validated fields with defaults, then apply
 * legacy `defaultOllamaModel` migration when no explicit chat keys exist.
 */
export function mergeStoredPreferences(
  parsed: unknown,
  defaults: Preferences,
): Preferences {
  const partial = parsePreferencesJson(parsed);
  const raw = asRecord(parsed);
  const merged: Preferences = { ...defaults, ...partial };
  return applyLegacyOllamaMigration(merged, partial, raw);
}
