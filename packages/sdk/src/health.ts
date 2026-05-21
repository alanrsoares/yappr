/**
 * Typed `/health` probe for the Yappr Python sidecar.
 *
 * Returns the daemon's view of which engines are currently loaded so the apps
 * can render a "currently serving: kokoro / dia / whisper" indicator in
 * settings (and short-circuit smoke flows when something's down).
 */

import { toError } from "@yappr/lib/result";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

const HealthResponseSchema = z.object({
  tts: z.enum(["ready", "unavailable"]),
  stt: z.enum(["ready", "unavailable"]),
  tts_backend: z.string().nullable(),
  stt_backend: z.string().nullable(),
});

export type HealthReadiness = "ready" | "unavailable";

export interface HealthSnapshot {
  tts: HealthReadiness;
  stt: HealthReadiness;
  ttsBackend: string | null;
  sttBackend: string | null;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

/**
 * Hit `GET ${baseUrl}/health` and parse the typed snapshot.
 *
 * Failures (network, non-2xx, schema mismatch) come back as an `Err`. Apps
 * typically render them as a "(unreachable)" footer rather than a hard error.
 */
export function probeHealth(
  baseUrl: string,
): ResultAsync<HealthSnapshot, Error> {
  return ResultAsync.fromPromise(
    (async () => {
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
      } satisfies HealthSnapshot;
    })(),
    toError,
  );
}
