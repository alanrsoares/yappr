/**
 * One-stop catalogue of speech-endpoint presets surfaced in the apps' setup
 * wizards and settings screens. Each preset returns an
 * {@link OpenAiCompatibleSpeechEndpointInput} or
 * {@link YapprSpeechEndpointInput} ready to drop into a
 * {@link VoiceConfigInput}; callers wrap with the matching transcription
 * endpoint separately (`yappr` is the only STT option today).
 *
 * Centralising these stops the same defaults drifting across:
 *
 *   - CLI setup wizard (`SpeechStep`)
 *   - CLI settings store (`buildSpeechPreset`)
 *   - Desktop voice store (`setSpeechKindPersist`)
 */

import { match } from "ts-pattern";

import {
  DEFAULT_SERVER_URL,
  DEFAULT_SPEED,
  DEFAULT_VOICE,
} from "./defaults.js";
import type {
  OpenAiCompatibleSpeechEndpointInput,
  YapprSpeechEndpointInput,
} from "./schemas.js";
import {
  VOXTRAL_MODEL_ID,
  type VoxtralVoiceId,
  voxtralSpeechPreset,
} from "./voxtral-voices.js";

export type SpeechPresetKind = "yappr" | "voxtral" | "custom";

export interface YapprPresetOverrides {
  baseUrl?: string;
  voice?: string;
  speed?: number;
}

export function yapprSpeechPreset(
  overrides: YapprPresetOverrides = {},
): YapprSpeechEndpointInput {
  return {
    kind: "yappr",
    baseUrl: overrides.baseUrl ?? DEFAULT_SERVER_URL,
    voice: overrides.voice ?? DEFAULT_VOICE,
    speed: overrides.speed ?? DEFAULT_SPEED,
  };
}

export interface CustomOpenAiPresetOverrides {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  voice?: string;
}

/**
 * Blank-ish OpenAI-compatible preset. Callers should treat the returned model
 * + voice as placeholders the user will customise via the UI; the schema
 * requires a non-empty string in both fields so we ship sensible literals
 * users will recognise and want to replace.
 */
export function customOpenAiSpeechPreset(
  overrides: CustomOpenAiPresetOverrides = {},
): OpenAiCompatibleSpeechEndpointInput {
  return {
    kind: "openai-compatible",
    baseUrl: overrides.baseUrl ?? "https://api.example.com/v1",
    ...(overrides.apiKey ? { apiKey: overrides.apiKey } : {}),
    model: overrides.model ?? "tts-1",
    voice: overrides.voice ?? "alloy",
    format: "wav",
  };
}

export type SpeechPresetOverrides = {
  baseUrl?: string;
  apiKey?: string;
  voice?: string;
  model?: string;
  speed?: number;
};

/**
 * Dispatch a preset by kind. Apps use this when the user picks a preset name
 * from a UI control; the returned shape plugs straight into
 * `VoiceConfigInput.speech`.
 */
export function buildSpeechPreset(
  kind: SpeechPresetKind,
  overrides: SpeechPresetOverrides = {},
): YapprSpeechEndpointInput | OpenAiCompatibleSpeechEndpointInput {
  return match(kind)
    .with("yappr", () => yapprSpeechPreset(overrides))
    .with("voxtral", () =>
      voxtralSpeechPreset({
        ...(overrides.baseUrl ? { baseUrl: overrides.baseUrl } : {}),
        ...(overrides.apiKey ? { apiKey: overrides.apiKey } : {}),
        ...(overrides.voice
          ? { voice: overrides.voice as VoxtralVoiceId }
          : {}),
      }),
    )
    .with("custom", () => customOpenAiSpeechPreset(overrides))
    .exhaustive();
}

/**
 * Inverse of {@link buildSpeechPreset}: detect the preset a config came from
 * so the UI can highlight the active row. Anything openai-compatible that
 * isn't Voxtral is treated as custom.
 */
export function detectSpeechPreset(
  speech: YapprSpeechEndpointInput | OpenAiCompatibleSpeechEndpointInput,
): SpeechPresetKind {
  return match(speech)
    .with({ kind: "yappr" }, () => "yappr" as const)
    .with(
      { kind: "openai-compatible", model: VOXTRAL_MODEL_ID },
      () => "voxtral" as const,
    )
    .otherwise(() => "custom" as const);
}
