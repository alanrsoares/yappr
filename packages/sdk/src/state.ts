import { DEFAULT_VOICE } from "./defaults.js";
import type { VoiceId } from "./schemas.js";

/** Inference server health state. */
export type HealthState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; voices: number }
  | { kind: "fail"; reason: string };

/** Active TTS playback state. */
export type TtsState =
  | { kind: "idle" }
  | { kind: "speaking" }
  | { kind: "error"; reason: string };

/** Pure: build the "ok" health state from a voice list. */
export const toHealthOk = (voices: readonly VoiceId[]): HealthState => ({
  kind: "ok",
  voices: voices.length,
});

/** Pure: build the "fail" health state from an error message. */
export const toHealthFail = (reason: string): HealthState => ({
  kind: "fail",
  reason,
});

/** Pure: build a TTS error state. */
export const toTtsError = (reason: string): TtsState => ({
  kind: "error",
  reason,
});

/**
 * Pure: pick a voice from a fresh list, preserving the current selection when
 * still valid. Curried (data-last) for use in pipelines and React setters:
 *
 *   setVoice((prev) => pickVoice(prev)(list))
 */
export const pickVoice =
  (current: VoiceId) =>
  (list: readonly VoiceId[]): VoiceId =>
    list.length === 0
      ? DEFAULT_VOICE
      : list.includes(current)
        ? current
        : (list[0] ?? DEFAULT_VOICE);

/** Pure: cassette-deck speed readout, e.g. `1.00×`. */
export const formatSpeed = (speed: number): string => `${speed.toFixed(2)}×`;

/** Pure: zero-padded voice count for LCD readouts, e.g. `054`. */
export const formatVoiceCount = (n: number): string =>
  n.toString().padStart(3, "0");
