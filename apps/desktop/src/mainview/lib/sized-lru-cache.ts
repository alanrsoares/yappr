import { err, ok, type Result } from "neverthrow";

type SizedCacheEntry<T> = {
  value: T;
  size: number;
};

export type SizedLruCacheMiss = {
  kind: "miss";
  key: string;
};

export type SizedLruCacheOptions<T> = {
  maxItems: number;
  maxSize: number;
  sizeOf: (value: T) => number;
};

export class SizedLruCache<T> {
  #entries = new Map<string, SizedCacheEntry<T>>();
  #totalSize = 0;

  constructor(private readonly options: SizedLruCacheOptions<T>) {}

  get(key: string): Result<T, SizedLruCacheMiss> {
    const entry = this.#entries.get(key);
    if (!entry) return err({ kind: "miss", key });
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return ok(entry.value);
  }

  set(key: string, value: T): void {
    const size = this.options.sizeOf(value);
    if (size > this.options.maxSize) return;
    this.#delete(key);
    this.#entries.set(key, { value, size });
    this.#totalSize += size;
    this.#evict();
  }

  #delete(key: string): void {
    const entry = this.#entries.get(key);
    if (!entry) return;
    this.#entries.delete(key);
    this.#totalSize -= entry.size;
  }

  #evict(): void {
    while (
      this.#entries.size > this.options.maxItems ||
      this.#totalSize > this.options.maxSize
    ) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#delete(oldest);
    }
  }
}
