/**
 * Typed `/health` probe for the Yappr Python sidecar.
 *
 * Returns the daemon's view of which engines are currently loaded (so apps can
 * render a "currently serving: kokoro / whisper" indicator in settings and
 * short-circuit smoke flows when something's down) plus the active TTS
 * adapter's capability metaconfig (`ttsFeatures`) so apps render only the
 * controls a backend actually honours — e.g. the voice-reference panel.
 */

import { Data, Effect } from "effect";
import { z } from "zod";

const TtsFeaturesSchema = z.object({
  cloning: z.boolean(),
  speed: z.boolean(),
  named_voices: z.boolean(),
});

const HealthResponseSchema = z.object({
  tts: z.enum(["ready", "unavailable"]),
  stt: z.enum(["ready", "unavailable"]),
  tts_backend: z.string().nullable(),
  stt_backend: z.string().nullable(),
  // Older daemons predate the features field — treat absent as null.
  tts_features: TtsFeaturesSchema.nullish(),
});

export type HealthReadiness = "ready" | "unavailable";

/** Capability metaconfig the active TTS adapter advertises (see ports.TtsFeatures). */
export interface TtsFeatures {
  /** Engine honours a voice `reference` for cloning. Drives the reference panel. */
  cloning: boolean;
  /** Engine honours the `speed` multiplier. Drives the speed slider. */
  speed: boolean;
  /** Engine exposes a catalog of named voice ids. Drives the voice picker. */
  namedVoices: boolean;
}

export interface HealthSnapshot {
  tts: HealthReadiness;
  stt: HealthReadiness;
  ttsBackend: string | null;
  sttBackend: string | null;
  ttsFeatures: TtsFeatures | null;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

/** Network / non-2xx / schema-mismatch failure from the `/health` probe. */
export class HealthProbeError extends Data.TaggedError("HealthProbeError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Hit `GET ${baseUrl}/health` and parse the typed snapshot.
 *
 * Failures (network, non-2xx, schema mismatch) come back in the Effect error
 * channel as {@link HealthProbeError}. Apps typically render them as a
 * "(unreachable)" footer rather than a hard error.
 */
export const probeHealth = (
  baseUrl: string,
): Effect.Effect<HealthSnapshot, HealthProbeError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${trimTrailingSlash(baseUrl)}/health`);
      if (!res.ok) {
        throw new Error(`/health → HTTP ${res.status}`);
      }
      const parsed = HealthResponseSchema.parse(await res.json());
      return {
        tts: parsed.tts,
        stt: parsed.stt,
        ttsBackend: parsed.tts_backend,
        sttBackend: parsed.stt_backend,
        ttsFeatures: parsed.tts_features
          ? {
              cloning: parsed.tts_features.cloning,
              speed: parsed.tts_features.speed,
              namedVoices: parsed.tts_features.named_voices,
            }
          : null,
      } satisfies HealthSnapshot;
    },
    catch: (cause) =>
      new HealthProbeError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });
