import { describe, expect, test } from "bun:test";

import { SizedLruCache } from "./sized-lru-cache";

describe("SizedLruCache", () => {
  const createCache = (options?: { maxItems?: number; maxSize?: number }) =>
    new SizedLruCache<string>({
      maxItems: options?.maxItems ?? 3,
      maxSize: options?.maxSize ?? 100,
      sizeOf: (value) => value.length,
    });

  test("returns Result misses and hits", () => {
    const cache = createCache();

    const miss = cache.get("missing");
    expect(miss.isErr()).toBe(true);
    expect(miss._unsafeUnwrapErr()).toEqual({
      kind: "miss",
      key: "missing",
    });

    cache.set("a", "alpha");
    const hit = cache.get("a");
    expect(hit.isOk()).toBe(true);
    expect(hit._unsafeUnwrap()).toBe("alpha");
  });

  test("evicts the least recently used entry by item count", () => {
    const cache = createCache({ maxItems: 2 });

    cache.set("a", "a");
    cache.set("b", "b");
    expect(cache.get("a").isOk()).toBe(true);
    cache.set("c", "c");

    expect(cache.get("b").isErr()).toBe(true);
    expect(cache.get("a")._unsafeUnwrap()).toBe("a");
    expect(cache.get("c")._unsafeUnwrap()).toBe("c");
  });

  test("evicts oldest entries by size budget", () => {
    const cache = createCache({ maxItems: 10, maxSize: 5 });

    cache.set("a", "aa");
    cache.set("b", "bb");
    cache.set("c", "cc");

    expect(cache.get("a").isErr()).toBe(true);
    expect(cache.get("b")._unsafeUnwrap()).toBe("bb");
    expect(cache.get("c")._unsafeUnwrap()).toBe("cc");
  });

  test("skips values larger than the size budget", () => {
    const cache = createCache({ maxSize: 3 });

    cache.set("huge", "abcd");

    expect(cache.get("huge").isErr()).toBe(true);
  });
});
