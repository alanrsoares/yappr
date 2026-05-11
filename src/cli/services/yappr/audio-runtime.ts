import { mkdirSync } from "fs";
import path from "path";
import { spawn } from "bun";
import type { ResultAsync } from "neverthrow";

import { AudioRecorder } from "~/sdk/recorder.js";
import { TTSClient } from "~/sdk/tts.js";
import type { RecordOptions, TTSOptions } from "~/sdk/types.js";

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

export interface TtsPort {
  listVoices(): ResultAsync<string[], Error>;
  synthesize(text: string, options?: TTSOptions): ResultAsync<ArrayBuffer, Error>;
  transcribe(filePath: string): ResultAsync<string, Error>;
}

export interface RecorderPort {
  record(
    outputPath: string,
    deviceIndex?: number,
    options?: RecordOptions,
  ): ResultAsync<void, Error>;
}

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

export function createAudioRuntime(options: CreateAudioRuntimeOptions = {}): AudioRuntime {
  const projectRoot = options.projectRoot ?? process.cwd();
  const paths = resolveAudioPaths(projectRoot);
  const playback = options.playback ?? createPlaybackPort();

  return {
    tts: options.tts ?? new TTSClient(),
    recorder: options.recorder ?? new AudioRecorder(),
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
