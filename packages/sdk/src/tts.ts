import { toError } from "@yappr/lib/result";
import { ResultAsync } from "neverthrow";

import {
  SynthesizeRequestSchema,
  TranscribeResponseSchema,
  VoicesResponseSchema,
  type SynthesizeRequestInput,
  type VoiceId,
} from "./schemas.js";

export interface TTSOptions {
  voice?: VoiceId;
  speed?: number;
}

export class TTSClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl;
  }

  listVoices(): ResultAsync<VoiceId[], Error> {
    return ResultAsync.fromPromise(
      (async () => {
        const response = await fetch(`${this.baseUrl}/voices`);
        if (!response.ok) {
          throw new Error(`Failed to list voices: ${response.statusText}`);
        }
        const data = VoicesResponseSchema.parse(await response.json());
        return data.voices;
      })(),
      toError,
    );
  }

  transcribe(blob: Blob): ResultAsync<string, Error> {
    return ResultAsync.fromPromise(
      (async () => {
        const formData = new FormData();
        formData.append("file", blob);

        const response = await fetch(`${this.baseUrl}/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const data = TranscribeResponseSchema.parse(await response.json());
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
        const input: SynthesizeRequestInput = {
          text,
          voice: options.voice,
          speed: options.speed,
        };
        const body = SynthesizeRequestSchema.parse(input);

        const response = await fetch(`${this.baseUrl}/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
