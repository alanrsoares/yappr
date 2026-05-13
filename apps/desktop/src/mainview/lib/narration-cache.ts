import type { VoiceId } from "@yappr/sdk/schemas";

import { SizedLruCache } from "./sized-lru-cache";

export const DEFAULT_NARRATION_CACHE_ITEMS = 24;
export const DEFAULT_NARRATION_CACHE_BYTES = 64 * 1024 * 1024;

export type NarrationCacheKeyInput = {
  serverUrl: string;
  voice: VoiceId;
  speed: number;
  text: string;
};

export const narrationCacheKey = ({
  serverUrl,
  voice,
  speed,
  text,
}: NarrationCacheKeyInput): string =>
  JSON.stringify([serverUrl, voice, speed, text]);

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
