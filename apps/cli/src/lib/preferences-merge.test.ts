import { expect, test } from "bun:test";

import { mergeStoredPreferences } from "./preferences-merge.js";
import { DEFAULT_PREFERENCES } from "./preferences.js";

test("mergeStoredPreferences uses defaults for empty / invalid root", () => {
  expect(mergeStoredPreferences(null, DEFAULT_PREFERENCES)).toEqual(
    DEFAULT_PREFERENCES,
  );
  expect(mergeStoredPreferences([], DEFAULT_PREFERENCES)).toEqual(
    DEFAULT_PREFERENCES,
  );
});

test("mergeStoredPreferences migrates legacy defaultOllamaModel", () => {
  const merged = mergeStoredPreferences(
    { defaultOllamaModel: "llama3.1:8b" },
    DEFAULT_PREFERENCES,
  );
  expect(merged.defaultChatProvider).toBe("ollama");
  expect(merged.defaultChatModel).toBe("llama3.1:8b");
});

test("mergeStoredPreferences does not migrate when chat keys are present", () => {
  const merged = mergeStoredPreferences(
    {
      defaultOllamaModel: "llama3.1:8b",
      defaultChatModel: "other",
      defaultChatProvider: "ollama",
    },
    DEFAULT_PREFERENCES,
  );
  expect(merged.defaultChatModel).toBe("other");
});

test("mergeStoredPreferences keeps valid fields and drops invalid", () => {
  const merged = mergeStoredPreferences(
    { defaultVoice: 123, defaultChatModel: "x" },
    DEFAULT_PREFERENCES,
  );
  expect(merged.defaultVoice).toBe(DEFAULT_PREFERENCES.defaultVoice);
  expect(merged.defaultChatModel).toBe("x");
});
