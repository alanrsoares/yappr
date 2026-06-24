import { Effect } from "effect";

import { DEFAULT_SERVER_URL, DEFAULT_VOICE_CONFIG } from "./defaults.js";
import {
  type OpenAiCompatibleSpeechEndpoint,
  type OpenAiCompatibleTranscriptionEndpoint,
  OpenAiCompatibleVoicesResponseSchema,
  SpeechAudioResponseSchema,
  type SpeechEndpoint,
  type SpeechEndpointInput,
  SpeechEndpointSchema,
  TranscribeResponseSchema,
  type TranscriptionEndpoint,
  type TranscriptionEndpointInput,
  TranscriptionEndpointSchema,
  type VoiceConfig,
  type VoiceConfigInput,
  VoiceConfigSchema,
  type VoiceId,
} from "./schemas.js";
import { TTSClient, type TTSOptions, TtsError } from "./tts.js";

const toTtsError = (cause: unknown): TtsError =>
  new TtsError({
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });

export interface VoiceClient {
  listVoices(): Effect.Effect<VoiceId[], TtsError>;
  synthesize(
    text: string,
    options?: TTSOptions,
  ): Effect.Effect<ArrayBuffer, TtsError>;
  transcribe(blob: Blob): Effect.Effect<string, TtsError>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const endpointUrl = (baseUrl: string, path: string): string =>
  `${trimTrailingSlash(baseUrl)}${path}`;

const authHeaders = (apiKey?: string): Headers => {
  const headers = new Headers();
  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
};

const base64ToArrayBuffer = (value: string): ArrayBuffer => {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes.buffer;
};

const filenameFor = (blob: Blob): string => {
  const type = blob.type.toLowerCase();
  if (type.includes("wav")) return "recording.wav";
  if (type.includes("webm")) return "recording.webm";
  if (type.includes("mp4") || type.includes("m4a")) return "recording.m4a";
  if (type.includes("ogg")) return "recording.ogg";
  if (type.includes("mpeg")) return "recording.mp3";
  return "recording.bin";
};

export class YapprSpeechClient {
  private client: TTSClient;

  constructor(private endpoint: Extract<SpeechEndpoint, { kind: "yappr" }>) {
    this.client = new TTSClient(endpoint.baseUrl);
  }

  listVoices(): Effect.Effect<VoiceId[], TtsError> {
    return this.client.listVoices();
  }

  synthesize(
    text: string,
    options: TTSOptions = {},
  ): Effect.Effect<ArrayBuffer, TtsError> {
    return this.client.synthesize(text, {
      voice: options.voice ?? this.endpoint.voice,
      speed: options.speed ?? this.endpoint.speed,
      ...(options.reference ? { reference: options.reference } : {}),
    });
  }
}

export class OpenAiCompatibleSpeechClient {
  constructor(private endpoint: OpenAiCompatibleSpeechEndpoint) {}

  listVoices(): Effect.Effect<VoiceId[], TtsError> {
    return Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          endpointUrl(this.endpoint.baseUrl, "/audio/voices"),
          {
            headers: authHeaders(this.endpoint.apiKey),
          },
        );
        if (!res.ok) {
          return [this.endpoint.voice];
        }
        const parsed = OpenAiCompatibleVoicesResponseSchema.parse(
          await res.json(),
        );
        const entries = parsed.items ?? parsed.data ?? [];
        const voices = entries.map((entry) => entry.id);
        return voices.length > 0 ? voices : [this.endpoint.voice];
      },
      catch: toTtsError,
    });
  }

  synthesize(
    text: string,
    options: TTSOptions = {},
  ): Effect.Effect<ArrayBuffer, TtsError> {
    return Effect.tryPromise({
      try: async () => {
        const headers = authHeaders(this.endpoint.apiKey);
        headers.set("Content-Type", "application/json");
        const voice = options.voice ?? this.endpoint.voice;
        const body: Record<string, unknown> = {
          input: text,
          model: this.endpoint.model,
          response_format: this.endpoint.format,
          stream: false,
          voice,
        };
        const speed = options.speed ?? this.endpoint.speed;
        if (speed !== undefined) body.speed = speed;
        const res = await fetch(
          endpointUrl(this.endpoint.baseUrl, "/audio/speech"),
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            errorText || `Failed to synthesize: ${res.statusText}`,
          );
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = SpeechAudioResponseSchema.parse(await res.json());
          return base64ToArrayBuffer(data.audio_data);
        }
        return await res.arrayBuffer();
      },
      catch: toTtsError,
    });
  }
}

export class YapprTranscriptionClient {
  private client: TTSClient;

  constructor(endpoint: Extract<TranscriptionEndpoint, { kind: "yappr" }>) {
    this.client = new TTSClient(endpoint.baseUrl);
  }

  transcribe(blob: Blob): Effect.Effect<string, TtsError> {
    return this.client.transcribe(blob);
  }
}

export class OpenAiCompatibleTranscriptionClient {
  constructor(private endpoint: OpenAiCompatibleTranscriptionEndpoint) {}

  transcribe(blob: Blob): Effect.Effect<string, TtsError> {
    return Effect.tryPromise({
      try: async () => {
        const headers = authHeaders(this.endpoint.apiKey);
        const formData = new FormData();
        formData.append("file", blob, filenameFor(blob));
        formData.append("model", this.endpoint.model);
        const res = await fetch(
          endpointUrl(this.endpoint.baseUrl, "/audio/transcriptions"),
          {
            method: "POST",
            headers,
            body: formData,
          },
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            errorText || `Transcription failed: ${res.statusText}`,
          );
        }
        const data = TranscribeResponseSchema.parse(await res.json());
        return data.text;
      },
      catch: toTtsError,
    });
  }
}

export class EndpointVoiceClient implements VoiceClient {
  private speech: YapprSpeechClient | OpenAiCompatibleSpeechClient;
  private transcription:
    | YapprTranscriptionClient
    | OpenAiCompatibleTranscriptionClient;

  constructor(config: VoiceConfigInput = DEFAULT_VOICE_CONFIG) {
    const parsed = VoiceConfigSchema.parse(config);
    this.speech = createSpeechClient(parsed.speech);
    this.transcription = createTranscriptionClient(parsed.transcription);
  }

  listVoices(): Effect.Effect<VoiceId[], TtsError> {
    return this.speech.listVoices();
  }

  synthesize(
    text: string,
    options?: TTSOptions,
  ): Effect.Effect<ArrayBuffer, TtsError> {
    return this.speech.synthesize(text, options);
  }

  transcribe(blob: Blob): Effect.Effect<string, TtsError> {
    return this.transcription.transcribe(blob);
  }
}

export function createSpeechClient(
  endpoint: SpeechEndpointInput,
): YapprSpeechClient | OpenAiCompatibleSpeechClient {
  const parsed = SpeechEndpointSchema.parse(endpoint);
  if (parsed.kind === "yappr") return new YapprSpeechClient(parsed);
  return new OpenAiCompatibleSpeechClient(parsed);
}

export function createTranscriptionClient(
  endpoint: TranscriptionEndpointInput,
): YapprTranscriptionClient | OpenAiCompatibleTranscriptionClient {
  const parsed = TranscriptionEndpointSchema.parse(endpoint);
  if (parsed.kind === "yappr") return new YapprTranscriptionClient(parsed);
  return new OpenAiCompatibleTranscriptionClient(parsed);
}

export function createVoiceClient(
  config: VoiceConfigInput = DEFAULT_VOICE_CONFIG,
): VoiceClient {
  return new EndpointVoiceClient(config);
}

export function localVoiceConfig(
  baseUrl: string = DEFAULT_SERVER_URL,
): VoiceConfig {
  return VoiceConfigSchema.parse({
    speech: {
      ...DEFAULT_VOICE_CONFIG.speech,
      baseUrl,
    },
    transcription: {
      kind: "yappr",
      baseUrl,
    },
  });
}

export function withSpeechEndpoint(
  config: VoiceConfigInput,
  speech: SpeechEndpointInput,
): VoiceConfig {
  const parsed = VoiceConfigSchema.parse(config);
  return VoiceConfigSchema.parse({ ...parsed, speech });
}

export function withTranscriptionEndpoint(
  config: VoiceConfigInput,
  transcription: TranscriptionEndpointInput,
): VoiceConfig {
  const parsed = VoiceConfigSchema.parse(config);
  return VoiceConfigSchema.parse({ ...parsed, transcription });
}
