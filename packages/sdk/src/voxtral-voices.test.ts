import { describe, expect, test } from "bun:test";

import {
  isVoxtralVoiceId,
  VOXTRAL_BASELINE_VOICES,
  VOXTRAL_EMOTION_VOICES,
  VOXTRAL_VOICES,
} from "./voxtral-voices";

describe("VOXTRAL_VOICES", () => {
  test("union covers baseline + emotion cohorts", () => {
    expect(VOXTRAL_VOICES).toEqual([
      ...VOXTRAL_BASELINE_VOICES,
      ...VOXTRAL_EMOTION_VOICES,
    ]);
  });

  test("has no duplicate ids", () => {
    const seen = new Set<string>();
    for (const id of VOXTRAL_VOICES) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});

describe("isVoxtralVoiceId", () => {
  test("recognises baseline + emotion ids", () => {
    expect(isVoxtralVoiceId("casual_male")).toBe(true);
    expect(isVoxtralVoiceId("gb_jane_sad")).toBe(true);
    expect(isVoxtralVoiceId("fr_marie_happy")).toBe(true);
  });

  test("rejects unknown ids", () => {
    expect(isVoxtralVoiceId("not_a_voice")).toBe(false);
    expect(isVoxtralVoiceId("")).toBe(false);
  });
});
