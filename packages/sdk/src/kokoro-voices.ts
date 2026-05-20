/**
 * Static catalog of Kokoro v1 American English voice IDs shipped with the
 * `hexgrad/Kokoro-82M` weights (lang_code=a). Used as the compile-time
 * fallback so apps don't have to await the Python sidecar's `/voices`
 * endpoint just to populate a picker on first paint.
 *
 * The Python server's `/voices` endpoint remains the runtime source of truth
 * — if the daemon ever exposes user-installed third-party voices, callers
 * should prefer the live list over this constant. Keep both lists in sync
 * (see `python/core.py:get_voices`).
 */
export const KOKORO_VOICES = [
  "af_alloy",
  "af_aoede",
  "af_bella",
  "af_heart",
  "af_jessica",
  "af_kore",
  "af_nicole",
  "af_nova",
  "af_river",
  "af_sarah",
  "af_sky",
  "am_adam",
  "am_echo",
  "am_eric",
  "am_fenrir",
  "am_liam",
  "am_michael",
  "am_onyx",
  "am_puck",
  "am_santa",
] as const;

export type KokoroVoiceId = (typeof KOKORO_VOICES)[number];

const KOKORO_VOICE_SET = new Set<string>(KOKORO_VOICES);

export function isKokoroVoiceId(value: string): value is KokoroVoiceId {
  return KOKORO_VOICE_SET.has(value);
}
