/**
 * Web Audio playback helpers for the desktop webview.
 * Pairs with `~/services/yappr` on the CLI (Bun runtime + WAV file) — same Kokoro contract, different transport.
 */
import type { VoiceId } from "~/services/yappr";
import type { HealthState, TtsState } from "../types";

export const DEFAULT_VOICE: VoiceId = "af_aoede";
export const DEFAULT_SERVER_URL = "http://localhost:8000";
export const DEFAULT_TEXT = "Hello from Yappr.";
export const DEFAULT_SPEED = 1.0;

/** Pure: pick a voice from a fresh list, preserving the current selection when valid. */
export const pickVoice =
  (current: VoiceId) =>
  (list: readonly VoiceId[]): VoiceId =>
    list.length === 0
      ? DEFAULT_VOICE
      : list.includes(current)
        ? current
        : (list[0] ?? DEFAULT_VOICE);

/** Pure: derive next health state from a refresh result. */
export const toHealthOk = (voices: readonly VoiceId[]): HealthState => ({
  kind: "ok",
  voices: voices.length,
});

export const toHealthFail = (reason: string): HealthState => ({
  kind: "fail",
  reason,
});

export const toTtsError = (reason: string): TtsState => ({
  kind: "error",
  reason,
});

export interface AudioHandle {
  readonly audio: HTMLAudioElement;
  readonly url: string;
}

/** Build an audio element + tracked blob URL from a WAV buffer. */
export const buildAudio = (buffer: ArrayBuffer): AudioHandle => {
  const blob = new Blob([buffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  return { audio: new Audio(url), url };
};

/** Release the blob URL and pause the element. Safe to call multiple times. */
export const disposeAudio = (handle: AudioHandle): void => {
  handle.audio.pause();
  URL.revokeObjectURL(handle.url);
};

/** Format speed as a cassette-deck readout: "1.00×" */
export const formatSpeed = (speed: number): string => `${speed.toFixed(2)}×`;

/** Format voice count for the LCD readout: zero-padded. */
export const formatVoiceCount = (n: number): string =>
  n.toString().padStart(3, "0");
