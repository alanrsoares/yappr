import { ResultAsync } from "neverthrow";

import type { components } from "./schema";

export type TTSOptions = Partial<components["schemas"]["SynthesizeRequest"]>;

interface VoicesResponse {
  voices: string[];
}

interface TranscribeResponse {
  text: string;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export class KittenTTSClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl;
  }

  listVoices(): ResultAsync<string[], Error> {
    return ResultAsync.fromPromise(
      (async () => {
        const response = await fetch(`${this.baseUrl}/voices`);
        if (!response.ok) {
          throw new Error(`Failed to list voices: ${response.statusText}`);
        }
        const data = (await response.json()) as VoicesResponse;
        return data.voices;
      })(),
      toError,
    );
  }

  transcribe(filePath: string): ResultAsync<string, Error> {
    return ResultAsync.fromPromise(
      (async () => {
        const file = Bun.file(filePath);
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${this.baseUrl}/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const data = (await response.json()) as TranscribeResponse;
        return data.text;
      })(),
      toError,
    );
  }

  synthesize(
    text: string,
    options: TTSOptions = {},
  ): ResultAsync<ArrayBuffer, Error> {
    return ResultAsync.fromPromise(
      (async () => {
        const body: components["schemas"]["SynthesizeRequest"] = {
          text,
          voice: options.voice ?? "af_bella",
          speed: options.speed ?? 1.0,
        };

        const response = await fetch(`${this.baseUrl}/synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to synthesize: ${response.status} - ${errorText}`,
          );
        }

        return await response.arrayBuffer();
      })(),
      toError,
    );
  }
}
