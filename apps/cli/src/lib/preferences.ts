import { mkdir } from "node:fs/promises";
import path from "node:path";
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

function getSettingsPath(): string {
  return path.join(userHomeDir(), ".yappr", "settings.json");
}

function isENOENT(e: unknown): boolean {
  return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

export function loadPreferences(): ResultAsync<Preferences, Error> {
  const filePath = getSettingsPath();
  return ResultAsync.fromPromise(
    readPreferencesFile(filePath).catch((e) => {
      if (isENOENT(e)) return { ...DEFAULT_PREFERENCES };
      throw e;
    }),
    toError,
  );
}

async function readPreferencesFile(filePath: string): Promise<Preferences> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return { ...DEFAULT_PREFERENCES };

  const raw = await file.text();
  const parsed: unknown = JSON.parse(raw);
  return mergeStoredPreferences(parsed, DEFAULT_PREFERENCES);
}

export function savePreferences(
  partial: Partial<Preferences>,
): ResultAsync<void, Error> {
  return loadPreferences()
    .andThen((current) =>
      ResultAsync.fromPromise(
        persistPreferences({ ...current, ...partial }),
        toError,
      ),
    )
    .map(() => undefined);
}

async function persistPreferences(merged: Preferences): Promise<void> {
  const dir = path.dirname(getSettingsPath());
  await mkdir(dir, { recursive: true });
  await Bun.write(getSettingsPath(), JSON.stringify(merged, null, 2));
}
