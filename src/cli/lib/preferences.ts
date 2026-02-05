/**
 * User preferences persisted to ~/.yappr/settings.json
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ResultAsync } from "neverthrow";

import type { Preferences } from "../types.js";

export const DEFAULT_PREFERENCES: Preferences = {
  defaultOllamaModel: "qwen2.5:14b",
  defaultVoice: "af_bella",
  defaultInputDeviceIndex: 0,
  defaultOutputDeviceIndex: 0,
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
      .then(
        (raw) =>
          ({
            ...DEFAULT_PREFERENCES,
            ...(JSON.parse(raw) as Partial<Preferences>),
          }) as Preferences,
      )
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
