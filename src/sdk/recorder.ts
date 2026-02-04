import { spawn } from "bun";

export interface RecordOptions {
  /** When aborted, recording stops. Use for TUI (e.g. Enter to stop) instead of stdin. */
  signal?: AbortSignal;
}

export class AudioRecorder {
  /**
   * Record from microphone. With signal: stops when signal is aborted (TUI-friendly).
   * Without signal: blocks on stdin until Enter (CLI-friendly).
   */
  async record(
    outputPath: string,
    deviceIndex: number = 0,
    options: RecordOptions = {}
  ): Promise<void> {
    const { signal } = options;

    const proc = spawn(
      [
        "ffmpeg", "-y", "-f", "avfoundation", "-i", `:${deviceIndex}`,
        "-ar", "16000", "-ac", "1", outputPath,
      ],
      { stdout: "ignore", stderr: "ignore" }
    );

    if (signal) {
      if (signal.aborted) {
        proc.kill();
        await proc.exited;
        return;
      }
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          proc.kill();
          void proc.exited.then(() => resolve());
        }, { once: true });
      });
      return;
    }

    console.log(`🎤 Recording (Device :${deviceIndex})... Press ENTER to send.`);
    for await (const _ of console) {
      break;
    }
    proc.kill();
    await proc.exited;
    console.log("Processing...");
  }
}
