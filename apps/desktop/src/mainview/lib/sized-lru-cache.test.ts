import { describe, expect, test } from "bun:test";

import { SizedLruCache } from "./sized-lru-cache";

describe("SizedLruCache", () => {
  const createCache = (options?: { maxItems?: number; maxSize?: number }) =>
    new SizedLruCache<string>({
      maxItems: options?.maxItems ?? 3,
      maxSize: options?.maxSize ?? 100,
      sizeOf: (value) => value.length,
    });

  test("returns null misses and value hits", () => {
    const cache = createCache();

    expect(cache.get("missing")).toBeNull();

    cache.set("a", "alpha");
    expect(cache.get("a")).toBe("alpha");
  });

  test("evicts the least recently used entry by item count", () => {
    const cache = createCache({ maxItems: 2 });

    cache.set("a", "a");
    cache.set("b", "b");
    expect(cache.get("a")).toBe("a");
    cache.set("c", "c");

    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe("a");
    expect(cache.get("c")).toBe("c");
  });

  test("evicts oldest entries by size budget", () => {
    const cache = createCache({ maxItems: 10, maxSize: 5 });

    cache.set("a", "aa");
    cache.set("b", "bb");
    cache.set("c", "cc");

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("bb");
    expect(cache.get("c")).toBe("cc");
  });

  test("skips values larger than the size budget", () => {
    const cache = createCache({ maxSize: 3 });

    cache.set("huge", "abcd");

    expect(cache.get("huge")).toBeNull();
  });
});
