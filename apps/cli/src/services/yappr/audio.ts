import { toError } from "@yappr/lib/result";
import {
  listInputDevices,
  listOutputDevices,
  type AudioDevice,
} from "@yappr/sdk/audio-devices";
import { DEFAULT_SPEED, DEFAULT_VOICE } from "@yappr/sdk/defaults";
import { ResultAsync } from "neverthrow";

import type { SpeakOptions } from "../../types.js";
import { getDefaultAudioRuntime, type AudioRuntime } from "./audio-runtime.js";

export type { AudioDevice };
export {
  createAudioRuntime,
  createPlaybackPort,
  getDefaultAudioRuntime,
  resetDefaultAudioRuntimeForTests,
  resolveAudioPaths,
  type AudioPaths,
  type AudioRuntime,
  type PlaybackPort,
  type RecorderPort,
  type TtsPort,
} from "./audio-runtime.js";

export { listInputDevices, listOutputDevices };

export function stopAudioPlayback(): void {
  getDefaultAudioRuntime().playback.stop();
}

export function listVoices(): ResultAsync<string[], Error> {
  return listVoicesWithRuntime(getDefaultAudioRuntime());
}

export function listVoicesWithRuntime(
  runtime: AudioRuntime,
): ResultAsync<string[], Error> {
  return runtime.tts.listVoices();
}

export function speak(
  text: string,
  options: SpeakOptions = {},
): ResultAsync<void, Error> {
  return speakWithRuntime(text, options, getDefaultAudioRuntime());
}

export function speakWithRuntime(
  text: string,
  options: SpeakOptions,
  runtime: AudioRuntime,
): ResultAsync<void, Error> {
  const { voice = DEFAULT_VOICE, speed = DEFAULT_SPEED, play = true } = options;
  const { outputWav } = runtime.paths;
  return runtime.tts
    .synthesize(text, { voice, speed })
    .andThen((audioData) =>
      ResultAsync.fromPromise(
        runtime.writeArrayBuffer(outputWav, audioData),
        toError,
      ).map(() => undefined as void),
    )
    .andTee(() => {
      if (!play) return;
      runtime.playback.stop();
      runtime.playback.playWav(outputWav);
    });
}

export interface RecordAndTranscribeOptions {
  deviceIndex?: number;
  recordSignal: AbortSignal;
  runtime?: AudioRuntime;
}

export function recordAndTranscribe(
  options: RecordAndTranscribeOptions,
): ResultAsync<string, Error> {
  const runtime = options.runtime ?? getDefaultAudioRuntime();
  return recordAndTranscribeWithRuntime(options, runtime);
}

export function recordAndTranscribeWithRuntime(
  options: Omit<RecordAndTranscribeOptions, "runtime">,
  runtime: AudioRuntime,
): ResultAsync<string, Error> {
  const { deviceIndex = 0, recordSignal } = options;
  const { inputWav } = runtime.paths;
  return runtime.recorder
    .record(inputWav, deviceIndex, { signal: recordSignal })
    .andThen(() => runtime.tts.transcribe(Bun.file(inputWav)))
    .map((t) => t?.trim() ?? "");
}
