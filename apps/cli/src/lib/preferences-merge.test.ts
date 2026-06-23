import { expect, test } from "bun:test";
import { DEFAULT_PREFERENCES } from "./preferences.js";
import { mergeStoredPreferences } from "./preferences-merge.js";

test("mergeStoredPreferences uses defaults for empty / invalid root", () => {
  expect(mergeStoredPreferences(null, DEFAULT_PREFERENCES)).toEqual(
    DEFAULT_PREFERENCES,
  );
  expect(mergeStoredPreferences([], DEFAULT_PREFERENCES)).toEqual(
    DEFAULT_PREFERENCES,
  );
});

test("mergeStoredPreferences keeps valid fields and drops invalid", () => {
  const merged = mergeStoredPreferences(
    { defaultVoice: 123, defaultChatModel: "x" },
    DEFAULT_PREFERENCES,
  );
  expect(merged.defaultVoice).toBe(DEFAULT_PREFERENCES.defaultVoice);
  expect(merged.defaultChatModel).toBe("x");
});
