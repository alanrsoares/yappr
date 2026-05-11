import { describe, expect, mock, test } from "bun:test";
import { okAsync, ResultAsync } from "neverthrow";

import {
  createAudioRuntime,
  createPlaybackPort,
  resolveAudioPaths,
} from "./audio-runtime.js";

describe("resolveAudioPaths", () => {
  test("nested tmp wav paths under project root", () => {
    const p = resolveAudioPaths("/proj");
    expect(p.tmpDir).toBe("/proj/tmp");
    expect(p.inputWav).toBe("/proj/tmp/input.wav");
    expect(p.outputWav).toBe("/proj/tmp/output.wav");
  });
});

describe("createPlaybackPort", () => {
  test("stub spawn: playWav invokes spawn with afplay on darwin", () => {
    const spawnFn = mock((_cmd: string[], _opts?: object) => ({
      kill: (): void => {},
    }));
    const prev = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });
    const playback = createPlaybackPort(spawnFn as never);
    playback.playWav("/tmp/x.wav");
    Object.defineProperty(process, "platform", { value: prev });
    expect(spawnFn).toHaveBeenCalled();
    const call = spawnFn.mock.calls[0];
    expect(call?.[0]).toEqual(["afplay", "/tmp/x.wav"]);
  });
});

describe("createAudioRuntime", () => {
  test("injected TTS port is used (no real HTTP)", async () => {
    const tts = {
      listVoices: () => okAsync<string[], Error>(["af_test"]),
      synthesize: () =>
        ResultAsync.fromPromise(Promise.reject(new Error("should not run")), (e) =>
          e instanceof Error ? e : new Error(String(e)),
        ),
      transcribe: () =>
        ResultAsync.fromPromise(Promise.reject(new Error("should not run")), (e) =>
          e instanceof Error ? e : new Error(String(e)),
        ),
    };
    const rt = createAudioRuntime({
      projectRoot: "/tmp/yappr-fp-test",
      tts,
      playback: createPlaybackPort(() => ({ kill: () => {} }) as never),
      writeArrayBuffer: async () => {},
    });
    rt.ensureTmp();
    const voices = await rt.tts.listVoices().match(
      (v) => v,
      (e) => {
        throw e;
      },
    );
    expect(voices).toEqual(["af_test"]);
  });
});
