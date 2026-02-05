/**
 * User preferences persisted to ~/.yappr/settings.json
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ResultAsync } from "neverthrow";

import { MCP_CONFIG_PATH } from "../constants.js";
import type { Preferences } from "../types.js";

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
  const home = process.env.HOME ?? "";
  return path.join(home, ".yappr", "settings.json");
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

function isENOENT(e: unknown): boolean {
  return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

export function loadPreferences(): ResultAsync<Preferences, Error> {
  const filePath = getSettingsPath();
  return ResultAsync.fromPromise(
    readFile(filePath, "utf-8")
      .then((raw) => {
        const partial = JSON.parse(raw) as Partial<Preferences> & {
          defaultOllamaModel?: string;
        };
        const prefs: Preferences = {
          ...DEFAULT_PREFERENCES,
          ...partial,
        };
        if (
          partial.defaultOllamaModel != null &&
          (prefs.defaultChatProvider == null || prefs.defaultChatModel == null)
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
