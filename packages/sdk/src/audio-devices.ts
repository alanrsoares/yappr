import { toError } from "@yappr/lib/result";
import { spawn } from "bun";
import { ResultAsync } from "neverthrow";

import type { AudioDevice } from "./types.js";

export function listInputDevices(): ResultAsync<AudioDevice[], Error> {
  return ResultAsync.fromPromise(
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
    toError,
  );
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

export function listOutputDevices(): ResultAsync<AudioDevice[], Error> {
  return ResultAsync.fromSafePromise(Promise.resolve(OUTPUT_SYSTEM_DEFAULT));
}

export { type AudioDevice } from "./types.js";
