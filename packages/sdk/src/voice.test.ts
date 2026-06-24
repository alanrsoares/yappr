import { afterEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createVoiceClient } from "./voice.js";

const originalFetch = globalThis.fetch;

type FetchHandler = (
  ...args: Parameters<typeof fetch>
) => ReturnType<typeof fetch>;

const mockFetch = (handler: FetchHandler): typeof fetch =>
  Object.assign(handler, { preconnect: originalFetch.preconnect });

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createVoiceClient", () => {
  test("reads binary audio from an OpenAI-compatible speech endpoint", async () => {
    const audio = new Uint8Array([1, 2, 3]).buffer;
    globalThis.fetch = mockFetch(
      async () =>
        new Response(audio, {
          headers: { "content-type": "audio/wav" },
        }),
    );

    const client = createVoiceClient({
      speech: {
        kind: "openai-compatible",
        baseUrl: "http://localhost:8000/v1",
        model: "mistralai/Voxtral-4B-TTS-2603",
        voice: "casual_male",
      },
      transcription: {
        kind: "yappr",
        baseUrl: "http://localhost:8000",
      },
    });

    const result = await Effect.runPromise(client.synthesize("hello"));

    expect([...new Uint8Array(result)]).toEqual([1, 2, 3]);
  });

  test("decodes Mistral-style JSON speech audio", async () => {
    globalThis.fetch = mockFetch(async () =>
      Response.json({
        audio_data: globalThis.btoa("wav"),
      }),
    );

    const client = createVoiceClient({
      speech: {
        kind: "openai-compatible",
        baseUrl: "https://api.mistral.ai/v1",
        model: "voxtral-mini-tts-2603",
        voice: "voice-id",
      },
      transcription: {
        kind: "yappr",
        baseUrl: "http://localhost:8000",
      },
    });

    const result = await Effect.runPromise(client.synthesize("hello"));
    const bytes = new Uint8Array(result);

    expect([...bytes]).toEqual([119, 97, 118]);
  });

  test("falls back to configured voice when endpoint has no voices route", async () => {
    globalThis.fetch = mockFetch(
      async () => new Response("missing", { status: 404 }),
    );

    const client = createVoiceClient({
      speech: {
        kind: "openai-compatible",
        baseUrl: "http://localhost:8000/v1",
        model: "mistralai/Voxtral-4B-TTS-2603",
        voice: "casual_male",
      },
      transcription: {
        kind: "yappr",
        baseUrl: "http://localhost:8000",
      },
    });

    const result = await Effect.runPromise(client.listVoices());

    expect(result).toEqual(["casual_male"]);
  });
});
