import { spawn } from "bun";
import { Data, Effect } from "effect";

import type { AudioDevice } from "./types.js";

/** Failure enumerating audio input devices (ffmpeg/avfoundation). */
export class AudioDeviceError extends Data.TaggedError("AudioDeviceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export function listInputDevices(): Effect.Effect<
  AudioDevice[],
  AudioDeviceError
> {
  return Effect.tryPromise({
    try: () =>
      new Promise<AudioDevice[]>((resolve, reject) => {
        const proc = spawn(
          ["ffmpeg", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
          { stdout: "ignore", stderr: "pipe" },
        );

        const chunks: Uint8Array[] = [];

        async function readStream() {
          if (!proc.stderr) return;
          const reader = proc.stderr.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
          } finally {
            reader.releaseLock();
          }
        }

        Promise.all([readStream(), proc.exited])
          .then(() => {
            const output = Buffer.concat(chunks).toString();
            resolve(parseAvFoundationDevices(output));
          })
          .catch(reject);
      }),
    catch: (cause) =>
      new AudioDeviceError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });
}

function parseAvFoundationDevices(output: string): AudioDevice[] {
  const lines = output.split("\n");
  const devices: AudioDevice[] = [];
  let inAudioSection = false;

  for (const line of lines) {
    if (line.includes("AVFoundation audio devices:")) {
      inAudioSection = true;
      continue;
    }
    if (line.includes("AVFoundation video devices:")) {
      inAudioSection = false;
      continue;
    }
    if (inAudioSection) {
      const match = line.match(/\[(\d+)\]\s+(.+)$/);
      if (match?.[1] != null && match[2] != null) {
        devices.push({
          index: Number.parseInt(match[1], 10),
          name: match[2].trim(),
        });
      }
    }
  }
  return devices;
}

const OUTPUT_SYSTEM_DEFAULT: AudioDevice[] = [
  { index: 0, name: "System default" },
];

export function listOutputDevices(): Effect.Effect<AudioDevice[], never> {
  return Effect.succeed(OUTPUT_SYSTEM_DEFAULT);
}

export type { AudioDevice } from "./types.js";
