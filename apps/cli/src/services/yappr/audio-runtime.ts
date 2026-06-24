import { mkdirSync } from "node:fs";
import path from "node:path";
import { AudioRecorder } from "@yappr/sdk/recorder";
import { createVoiceClient, type VoiceClient } from "@yappr/sdk/voice";
import { spawn } from "bun";

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

/** The sdk's Effect voice client, used directly now the cli runs on Effect. */
export type TtsPort = VoiceClient;

/** The recorder surface the audio runtime needs (Effect-native). */
export type RecorderPort = Pick<AudioRecorder, "record">;

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
    tts: options.tts ?? createVoiceClient(),
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
