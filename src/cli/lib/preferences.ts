import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ResultAsync } from "neverthrow";

import { toError } from "~/lib/result.js";
import { MCP_CONFIG_PATH, userHomeDir } from "../constants.js";
import type { Preferences } from "../types.js";

import {
  type PreferencesJsonPartial,
  parsePreferencesJson,
} from "./preferences-schema.js";

export const DEFAULT_PREFERENCES: Preferences = {
  ollamaBaseUrl: "http://localhost:11434",
  mcpConfigPath: MCP_CONFIG_PATH,
  defaultChatProvider: "ollama",
  defaultChatModel: "qwen2.5:14b",
  defaultVoice: "af_bella",
  defaultInputDeviceIndex: 0,
  defaultOutputDeviceIndex: 0,
  useNarrationForTTS: false,
  narrationModel: "",
  openrouterApiKey: "",
};

function getSettingsPath(): string {
  return path.join(userHomeDir(), ".yappr", "settings.json");
}

function isENOENT(e: unknown): boolean {
  return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

export function loadPreferences(): ResultAsync<Preferences, Error> {
  const filePath = getSettingsPath();
  return ResultAsync.fromPromise(
    readFile(filePath, "utf-8")
      .then((raw) => {
        const parsed: unknown = JSON.parse(raw);
        const partial: PreferencesJsonPartial = parsePreferencesJson(parsed);
        const rawRecord =
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
        const hasExplicitChatModel = Object.prototype.hasOwnProperty.call(
          rawRecord,
          "defaultChatModel",
        );
        const hasExplicitChatProvider = Object.prototype.hasOwnProperty.call(
          rawRecord,
          "defaultChatProvider",
        );

        const prefs: Preferences = {
          ...DEFAULT_PREFERENCES,
          ...partial,
        };

        // Legacy: migrate defaultOllamaModel when chat defaults were never written explicitly.
        if (
          typeof partial.defaultOllamaModel === "string" &&
          partial.defaultOllamaModel !== "" &&
          !hasExplicitChatModel &&
          !hasExplicitChatProvider
        ) {
          prefs.defaultChatProvider = "ollama";
          prefs.defaultChatModel = partial.defaultOllamaModel;
        }

        return prefs;
      })
      .catch((e) => {
        if (isENOENT(e)) return { ...DEFAULT_PREFERENCES };
        throw e;
      }),
    toError,
  );
}

export function savePreferences(
  partial: Partial<Preferences>,
): ResultAsync<void, Error> {
  return loadPreferences()
    .andThen((current) => {
      const merged = { ...current, ...partial };
      const dir = path.dirname(getSettingsPath());
      return ResultAsync.fromPromise(
        mkdir(dir, { recursive: true }).then(() =>
          writeFile(getSettingsPath(), JSON.stringify(merged, null, 2)),
        ),
        toError,
      );
    })
    .map(() => undefined);
}
