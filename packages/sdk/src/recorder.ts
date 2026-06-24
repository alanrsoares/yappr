import { spawn } from "bun";
import { Data, Effect } from "effect";

import type { RecordOptions } from "./types.js";

/** Failure capturing audio via ffmpeg. */
export class RecorderError extends Data.TaggedError("RecorderError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AudioRecorder {
  record(
    outputPath: string,
    deviceIndex: number = 0,
    options: RecordOptions = {},
  ): Effect.Effect<void, RecorderError> {
    return Effect.tryPromise({
      try: () => this.recordAsync(outputPath, deviceIndex, options),
      catch: (cause) =>
        new RecorderError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });
  }

  private async recordAsync(
    outputPath: string,
    deviceIndex: number,
    options: RecordOptions,
  ): Promise<void> {
    const { signal } = options;

    const proc = spawn(
      [
        "ffmpeg",
        "-y",
        "-f",
        "avfoundation",
        "-i",
        `:${deviceIndex}`,
        "-ar",
        "16000",
        "-ac",
        "1",
        outputPath,
      ],
      { stdout: "ignore", stderr: "ignore" },
    );

    if (signal) {
      if (signal.aborted) {
        proc.kill();
        await proc.exited;
        return;
      }
      await new Promise<void>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            proc.kill();
            void proc.exited.then(() => resolve());
          },
          { once: true },
        );
      });
      return;
    }

    console.log(
      `🎤 Recording (Device :${deviceIndex})... Press ENTER to send.`,
    );
    for await (const _ of console) {
      break;
    }
    proc.kill();
    await proc.exited;
    console.log("Processing...");
  }
}
