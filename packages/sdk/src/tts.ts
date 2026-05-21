import { toError } from "@yappr/lib/result";
import { ResultAsync } from "neverthrow";

import {
  SynthesizeRequestSchema,
  TranscribeResponseSchema,
  VoicesResponseSchema,
  type SynthesizeRequestInput,
  type VoiceId,
  type VoiceReferenceInput,
} from "./schemas.js";

const filenameFor = (blob: Blob): string => {
  const type = blob.type.toLowerCase();
  if (type.includes("wav")) return "recording.wav";
  if (type.includes("webm")) return "recording.webm";
  if (type.includes("mp4") || type.includes("m4a")) return "recording.m4a";
  if (type.includes("ogg")) return "recording.ogg";
  if (type.includes("mpeg")) return "recording.mp3";
  return "recording.bin";
};

export interface TTSOptions {
  voice?: VoiceId;
  speed?: number;
  /** Reference-audio voice clone (used by Dia; ignored by Kokoro). */
  reference?: VoiceReferenceInput;
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
        // Filename hint so the server (and faster-whisper / pyav) can pick the
        // right decoder. Without an extension, browsers send "blob" which has
        // tripped ffmpeg format-sniff on borderline inputs.
        formData.append("file", blob, filenameFor(blob));

        const response = await fetch(`${this.baseUrl}/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            body || `Transcription failed: ${response.statusText}`,
          );
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
          ...(options.reference ? { reference: options.reference } : {}),
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
