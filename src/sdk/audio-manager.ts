import { spawn } from "bun";
import { ResultAsync } from "neverthrow";

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export interface AudioDevice {
  index: number;
  name: string;
}

export class AudioManager {
  listDevices(): ResultAsync<AudioDevice[], Error> {
    return ResultAsync.fromPromise(
      new Promise<AudioDevice[]>((resolve, reject) => {
      // ffmpeg writes device list to stderr
      const proc = spawn(
        ["ffmpeg", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        {
          stdout: "ignore",
          stderr: "pipe", // Capture stderr
        },
      );

      const chunks: Uint8Array[] = [];

      // Read stderr
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

      // Wait for process to exit (it will fail with exit code, that's expected)
      Promise.all([readStream(), proc.exited])
        .then(() => {
          const output = Buffer.concat(chunks).toString();
          resolve(this.parseDeviceOutput(output));
        })
        .catch(reject);
    }),
    toError,
    );
  }

  private parseDeviceOutput(output: string): AudioDevice[] {
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
        if (match && match[1] && match[2]) {
          devices.push({
            index: parseInt(match[1], 10),
            name: match[2].trim(),
          });
        }
      }
    }
    return devices;
  }
}
