/**
 * Voice catalog for Mistral's Voxtral-4B-TTS-2603 served via vllm-omni.
 *
 * Yappr does NOT bundle Voxtral — it runs on a separate vllm-omni instance
 * (≥16 GB VRAM, Linux NVIDIA in practice, CC BY-NC 4.0 license) that users
 * launch themselves: `vllm serve mistralai/Voxtral-4B-TTS-2603 --omni`.
 * Apps reach it via the SDK's OpenAI-compatible speech client.
 *
 * IDs split into two cohorts:
 *  - **Baseline presets** documented in the model card (e.g. `casual_male`).
 *  - **Speaker + emotion variants** harvested from the HF Space demo
 *    (`gb_jane_*`, `en_paul_*`, `gb_oliver_*`, `fr_marie_*`).
 *
 * The vllm-omni server is the runtime authority; this list is the
 * compile-time fallback so settings pickers paint instantly.
 */

export const VOXTRAL_BASELINE_VOICES = [
  "casual_male",
  "casual_female",
  "cheerful_female",
  "neutral_male",
  "neutral_female",
] as const;

export const VOXTRAL_EMOTION_VOICES = [
  "gb_jane_neutral",
  "gb_jane_confident",
  "gb_jane_curious",
  "gb_jane_frustrated",
  "gb_jane_jealousy",
  "gb_jane_sad",
  "gb_jane_shameful",
  "gb_jane_confused",
  "gb_jane_sarcasm",
  "en_paul_neutral",
  "en_paul_confident",
  "en_paul_cheerful",
  "en_paul_happy",
  "en_paul_excited",
  "en_paul_frustrated",
  "en_paul_angry",
  "en_paul_sad",
  "gb_oliver_neutral",
  "gb_oliver_confident",
  "gb_oliver_cheerful",
  "gb_oliver_curious",
  "gb_oliver_excited",
  "gb_oliver_angry",
  "gb_oliver_sad",
  "fr_marie_neutral",
  "fr_marie_happy",
  "fr_marie_excited",
  "fr_marie_curious",
  "fr_marie_angry",
  "fr_marie_sad",
] as const;

export const VOXTRAL_VOICES = [
  ...VOXTRAL_BASELINE_VOICES,
  ...VOXTRAL_EMOTION_VOICES,
] as const;

export type VoxtralVoiceId = (typeof VOXTRAL_VOICES)[number];

const VOXTRAL_VOICE_SET = new Set<string>(VOXTRAL_VOICES);

export function isVoxtralVoiceId(value: string): value is VoxtralVoiceId {
  return VOXTRAL_VOICE_SET.has(value);
}

export const VOXTRAL_MODEL_ID = "mistralai/Voxtral-4B-TTS-2603";

/**
 * Suggested response format for Voxtral via the OpenAI-compatible TTS
 * endpoint. WAV gives the lowest decode overhead; matches the model's
 * native 24 kHz sample rate.
 */
export const VOXTRAL_DEFAULT_RESPONSE_FORMAT = "wav" as const;

/** Default vllm-omni endpoint a fresh `vllm serve … --omni` listens on. */
export const VOXTRAL_DEFAULT_BASE_URL = "http://localhost:8000/v1";

/** Default voice picked when the user hasn't selected one yet. */
export const VOXTRAL_DEFAULT_VOICE: VoxtralVoiceId = "casual_male";

/**
 * Pre-filled OpenAI-compatible speech endpoint config for a remote vllm-omni
 * instance serving Voxtral. Apps use this as a one-click "Voxtral preset" so
 * users don't have to type the model id / voice field / format by hand.
 */
export function voxtralSpeechPreset(overrides?: {
  baseUrl?: string;
  apiKey?: string;
  voice?: VoxtralVoiceId;
}) {
  return {
    kind: "openai-compatible" as const,
    baseUrl: overrides?.baseUrl ?? VOXTRAL_DEFAULT_BASE_URL,
    ...(overrides?.apiKey ? { apiKey: overrides.apiKey } : {}),
    model: VOXTRAL_MODEL_ID,
    voice: overrides?.voice ?? VOXTRAL_DEFAULT_VOICE,
    voiceField: "voice" as const,
    format: VOXTRAL_DEFAULT_RESPONSE_FORMAT,
  };
}
