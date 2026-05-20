import type { VoiceConfig, VoiceId } from "./schemas.js";

/**
 * Canonical defaults shared by every Yappr surface (CLI, desktop, SDK schema).
 * Mirrors the Python server's defaults in `python/server.py` — keep them in
 * sync when the upstream Kokoro/Whisper baseline changes.
 */
export const DEFAULT_VOICE: VoiceId = "af_aoede";
export const DEFAULT_SPEED = 1;
export const DEFAULT_SERVER_URL = "http://localhost:8000";
export const DEFAULT_TEXT = "Hello from Yappr.";

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  speech: {
    kind: "yappr",
    baseUrl: DEFAULT_SERVER_URL,
    voice: DEFAULT_VOICE,
    speed: DEFAULT_SPEED,
  },
  transcription: {
    kind: "yappr",
    baseUrl: DEFAULT_SERVER_URL,
  },
};
