type SizedCacheEntry<T> = {
  value: T;
  size: number;
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

  /** Cached value, or null on miss (a miss is absence, not a failure). */
  get(key: string): T | null {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
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
