import { toError } from "@yappr/lib/result";
import { DEFAULT_SPEED, DEFAULT_VOICE } from "@yappr/sdk/defaults";
import { Effect } from "effect";

import type { SpeakOptions } from "../../types.js";
import { type AudioRuntime, getDefaultAudioRuntime } from "./audio-runtime.js";

export {
  type AudioPaths,
  type AudioRuntime,
  createAudioRuntime,
  createPlaybackPort,
  getDefaultAudioRuntime,
  type PlaybackPort,
  type RecorderPort,
  resetDefaultAudioRuntimeForTests,
  resolveAudioPaths,
  type TtsPort,
} from "./audio-runtime.js";

export function stopAudioPlayback(): void {
  getDefaultAudioRuntime().playback.stop();
}

export const listVoices = (): Effect.Effect<string[], Error> =>
  listVoicesWithRuntime(getDefaultAudioRuntime());

export function listVoicesWithRuntime(
  runtime: AudioRuntime,
): Effect.Effect<string[], Error> {
  return runtime.tts.listVoices();
}

export const speak = (
  text: string,
  options: SpeakOptions = {},
): Effect.Effect<void, Error> =>
  speakWithRuntime(text, options, getDefaultAudioRuntime());

export function speakWithRuntime(
  text: string,
  options: SpeakOptions,
  runtime: AudioRuntime,
): Effect.Effect<void, Error> {
  const {
    voice = DEFAULT_VOICE,
    speed = DEFAULT_SPEED,
    play = true,
    reference,
  } = options;
  const { outputWav } = runtime.paths;
  return runtime.tts
    .synthesize(text, {
      voice,
      speed,
      ...(reference ? { reference } : {}),
    })
    .pipe(
      Effect.flatMap((audioData) =>
        Effect.tryPromise({
          try: () => runtime.writeArrayBuffer(outputWav, audioData),
          catch: toError,
        }),
      ),
      Effect.asVoid,
      Effect.tap(() =>
        Effect.sync(() => {
          if (!play) return;
          runtime.playback.stop();
          runtime.playback.playWav(outputWav);
        }),
      ),
    );
}

export interface RecordAndTranscribeOptions {
  deviceIndex?: number;
  recordSignal: AbortSignal;
  runtime?: AudioRuntime;
}

export function recordAndTranscribe(
  options: RecordAndTranscribeOptions,
): Effect.Effect<string, Error> {
  const runtime = options.runtime ?? getDefaultAudioRuntime();
  return recordAndTranscribeWithRuntime(options, runtime);
}

export function recordAndTranscribeWithRuntime(
  options: Omit<RecordAndTranscribeOptions, "runtime">,
  runtime: AudioRuntime,
): Effect.Effect<string, Error> {
  const { deviceIndex = 0, recordSignal } = options;
  const { inputWav } = runtime.paths;
  return runtime.recorder
    .record(inputWav, deviceIndex, { signal: recordSignal })
    .pipe(
      Effect.flatMap(() => runtime.tts.transcribe(Bun.file(inputWav))),
      Effect.map((t) => t?.trim() ?? ""),
    );
}

export {
  type AudioDevice,
  listInputDevices,
  listOutputDevices,
} from "@yappr/sdk/audio-devices";
