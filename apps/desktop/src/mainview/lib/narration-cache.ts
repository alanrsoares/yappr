import type { SpeechEndpoint, VoiceId } from "@yappr/sdk/schemas";

import { SizedLruCache } from "./sized-lru-cache";

export const DEFAULT_NARRATION_CACHE_ITEMS = 24;
export const DEFAULT_NARRATION_CACHE_BYTES = 64 * 1024 * 1024;

export type NarrationCacheKeyInput = {
  speech: SpeechEndpoint;
  voice: VoiceId;
  speed: number;
  text: string;
};

export const narrationCacheKey = ({
  speech,
  voice,
  speed,
  text,
}: NarrationCacheKeyInput): string =>
  JSON.stringify([speech, voice, speed, text]);

export class NarrationCache extends SizedLruCache<ArrayBuffer> {
  constructor({
    maxItems = DEFAULT_NARRATION_CACHE_ITEMS,
    maxBytes = DEFAULT_NARRATION_CACHE_BYTES,
  }: {
    maxItems?: number;
    maxBytes?: number;
  } = {}) {
    super({
      maxItems,
      maxSize: maxBytes,
      sizeOf: (buffer) => buffer.byteLength,
    });
  }
}
