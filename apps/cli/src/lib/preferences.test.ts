import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from "./preferences";

function withTempHome<T>(fn: (homeDir: string) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const homeDir = mkdtempSync(path.join(tmpdir(), "yappr-test-"));
  process.env.HOME = homeDir;
  return fn(homeDir).finally(() => {
    process.env.HOME = originalHome;
    rmSync(homeDir, { recursive: true, force: true });
  });
}

test("loadPreferences returns defaults when settings file does not exist", async () => {
  await withTempHome(async () => {
    const result = await Effect.runPromise(loadPreferences());
    expect(result).toEqual(DEFAULT_PREFERENCES);
  });
});

test("savePreferences merges with defaults and persists", async () => {
  await withTempHome(async (homeDir) => {
    const partial = {
      defaultChatModel: "custom-model",
      defaultInputDeviceIndex: 2,
    };

    await Effect.runPromise(savePreferences(partial));
    const loaded = await Effect.runPromise(loadPreferences());

    expect(loaded.defaultChatModel).toBe("custom-model");
    expect(loaded.defaultInputDeviceIndex).toBe(2);
    // unchanged fields should come from defaults
    expect(loaded.defaultVoice).toBe(DEFAULT_PREFERENCES.defaultVoice);
    expect(loaded.ollamaBaseUrl).toBe(DEFAULT_PREFERENCES.ollamaBaseUrl);

    // ensure DB was written under the temporary HOME
    const dbPath = path.join(homeDir, ".yappr", "yappr.db");
    expect(existsSync(dbPath)).toBe(true);
  });
});

test("loadPreferences skips invalid fields and keeps valid ones", async () => {
  await withTempHome(async (homeDir) => {
    const settingsDir = path.join(homeDir, ".yappr");
    const settingsPath = path.join(settingsDir, "settings.json");

    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          defaultVoice: 999,
          defaultChatModel: "kept-model",
          notARealKey: "ignored",
        },
        null,
        2,
      ),
      "utf8",
    );

    const prefs = await Effect.runPromise(loadPreferences());

    expect(prefs.defaultVoice).toBe(DEFAULT_PREFERENCES.defaultVoice);
    expect(prefs.defaultChatModel).toBe("kept-model");
  });
});
