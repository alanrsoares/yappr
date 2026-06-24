import type { Preferences } from "../types.js";
import { parsePreferencesJson } from "./preferences-schema.js";

/**
 * Parse stored settings JSON: merge validated fields with defaults. Unknown
 * keys and invalid values are silently dropped per-field by
 * {@link parsePreferencesJson}.
 */
export const mergeStoredPreferences = (
  parsed: unknown,
  defaults: Preferences,
): Preferences => ({ ...defaults, ...parsePreferencesJson(parsed) });
