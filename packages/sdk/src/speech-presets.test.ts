import { describe, expect, test } from "bun:test";

import { DEFAULT_SERVER_URL, DEFAULT_VOICE } from "./defaults";
import {
  buildSpeechPreset,
  customOpenAiSpeechPreset,
  detectSpeechPreset,
  yapprSpeechPreset,
} from "./speech-presets";
import { VOXTRAL_DEFAULT_VOICE, VOXTRAL_MODEL_ID } from "./voxtral-voices";

describe("yapprSpeechPreset", () => {
  test("returns sensible defaults", () => {
    const preset = yapprSpeechPreset();
    expect(preset.kind).toBe("yappr");
    expect(preset.baseUrl).toBe(DEFAULT_SERVER_URL);
    expect(preset.voice).toBe(DEFAULT_VOICE);
  });

  test("applies overrides", () => {
    const preset = yapprSpeechPreset({
      baseUrl: "http://lan:8000",
      voice: "am_eric",
      speed: 1.25,
    });
    expect(preset.baseUrl).toBe("http://lan:8000");
    expect(preset.voice).toBe("am_eric");
    expect(preset.speed).toBe(1.25);
  });
});

describe("customOpenAiSpeechPreset", () => {
  test("emits a customisable shell with format=wav", () => {
    const preset = customOpenAiSpeechPreset();
    expect(preset.kind).toBe("openai-compatible");
    expect(preset.format).toBe("wav");
    expect(preset.apiKey).toBeUndefined();
  });

  test("threads apiKey only when set", () => {
    const preset = customOpenAiSpeechPreset({ apiKey: "sk-test" });
    expect(preset.apiKey).toBe("sk-test");
  });
});

describe("buildSpeechPreset", () => {
  test("dispatches by kind", () => {
    expect(buildSpeechPreset("yappr").kind).toBe("yappr");
    const vox = buildSpeechPreset("voxtral");
    expect(vox.kind).toBe("openai-compatible");
    if (vox.kind === "openai-compatible") {
      expect(vox.model).toBe(VOXTRAL_MODEL_ID);
      expect(vox.voice).toBe(VOXTRAL_DEFAULT_VOICE);
    }
    expect(buildSpeechPreset("custom").kind).toBe("openai-compatible");
  });
});

describe("detectSpeechPreset", () => {
  test("identifies each preset", () => {
    expect(detectSpeechPreset(yapprSpeechPreset())).toBe("yappr");
    expect(detectSpeechPreset(buildSpeechPreset("voxtral"))).toBe("voxtral");
    expect(detectSpeechPreset(customOpenAiSpeechPreset())).toBe("custom");
  });
});
