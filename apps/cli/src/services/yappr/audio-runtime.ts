import { mkdirSync } from "node:fs";
import path from "node:path";
import { toResultAsync } from "@yappr/lib/effect";
import { AudioRecorder } from "@yappr/sdk/recorder";
import type { TTSOptions } from "@yappr/sdk/tts";
import type { RecordOptions } from "@yappr/sdk/types";
import { createVoiceClient, type VoiceClient } from "@yappr/sdk/voice";
import { spawn } from "bun";
import type { ResultAsync } from "neverthrow";

export interface AudioPaths {
  tmpDir: string;
  inputWav: string;
  outputWav: string;
}

export function resolveAudioPaths(projectRoot: string): AudioPaths {
  const tmpDir = path.join(projectRoot, "tmp");
  return {
    tmpDir,
    inputWav: path.join(tmpDir, "input.wav"),
    outputWav: path.join(tmpDir, "output.wav"),
  };
}

/** neverthrow-facing port over the sdk's Effect {@link VoiceClient}. */
export interface TtsPort {
  listVoices(): ResultAsync<string[], Error>;
  synthesize(
    text: string,
    options?: TTSOptions,
  ): ResultAsync<ArrayBuffer, Error>;
  transcribe(blob: Blob): ResultAsync<string, Error>;
}

export interface RecorderPort {
  record(
    outputPath: string,
    deviceIndex?: number,
    options?: RecordOptions,
  ): ResultAsync<void, Error>;
}

/** Bridge the sdk's Effect-based voice client into the neverthrow TtsPort. */
const toTtsPort = (client: VoiceClient): TtsPort => ({
  listVoices: () => toResultAsync(client.listVoices()),
  synthesize: (text, options) =>
    toResultAsync(client.synthesize(text, options)),
  transcribe: (blob) => toResultAsync(client.transcribe(blob)),
});

const toRecorderPort = (recorder: AudioRecorder): RecorderPort => ({
  record: (outputPath, deviceIndex, options) =>
    toResultAsync(recorder.record(outputPath, deviceIndex, options)),
});

export interface PlaybackPort {
  playWav(wavPath: string): void;
  stop(): void;
}

export type SpawnFn = typeof spawn;

export function createPlaybackPort(spawnFn: SpawnFn = spawn): PlaybackPort {
  let current: ReturnType<SpawnFn> | null = null;

  const stop = (): void => {
    if (current) {
      try {
        current.kill();
      } catch {
        /* process may already have exited */
      }
      current = null;
    }
  };

  return {
    playWav(wavPath: string): void {
      stop();
      if (process.platform === "darwin") {
        current = spawnFn(["afplay", wavPath], {
          stdout: "ignore",
          stderr: "ignore",
        });
      } else if (process.platform === "linux") {
        current = spawnFn(["aplay", wavPath], {
          stdout: "ignore",
          stderr: "ignore",
        });
      }
    },
    stop,
  };
}

export interface AudioRuntime {
  tts: TtsPort;
  recorder: RecorderPort;
  paths: AudioPaths;
  ensureTmp: () => void;
  writeArrayBuffer: (filePath: string, data: ArrayBuffer) => Promise<unknown>;
  playback: PlaybackPort;
}

export interface CreateAudioRuntimeOptions {
  projectRoot?: string;
  tts?: TtsPort;
  recorder?: RecorderPort;
  playback?: PlaybackPort;
  writeArrayBuffer?: (filePath: string, data: ArrayBuffer) => Promise<unknown>;
}

export function createAudioRuntime(
  options: CreateAudioRuntimeOptions = {},
): AudioRuntime {
  const projectRoot = options.projectRoot ?? process.cwd();
  const paths = resolveAudioPaths(projectRoot);
  const playback = options.playback ?? createPlaybackPort();

  return {
    tts: options.tts ?? toTtsPort(createVoiceClient()),
    recorder: options.recorder ?? toRecorderPort(new AudioRecorder()),
    paths,
    ensureTmp: () => {
      mkdirSync(paths.tmpDir, { recursive: true });
    },
    writeArrayBuffer:
      options.writeArrayBuffer ??
      ((filePath, data) => Bun.write(filePath, data)),
    playback,
  };
}

let defaultAudioRuntime: AudioRuntime | undefined;

export function getDefaultAudioRuntime(): AudioRuntime {
  if (!defaultAudioRuntime) {
    defaultAudioRuntime = createAudioRuntime();
    defaultAudioRuntime.ensureTmp();
  }
  return defaultAudioRuntime;
}

export function resetDefaultAudioRuntimeForTests(): void {
  defaultAudioRuntime = undefined;
}
