import { describe, expect, test } from "bun:test";

import { NarrationCache, narrationCacheKey } from "./narration-cache";

describe("narrationCacheKey", () => {
  test("includes speech endpoint, voice, speed, and text", () => {
    expect(
      narrationCacheKey({
        speech: {
          kind: "yappr",
          baseUrl: "http://localhost:8000",
          voice: "af_aoede",
          speed: 1,
        },
        voice: "af_aoede",
        speed: 1.25,
        text: "Hello",
      }),
    ).toBe(
      '[{"kind":"yappr","baseUrl":"http://localhost:8000","voice":"af_aoede","speed":1},"af_aoede",1.25,"Hello"]',
    );
  });
});

describe("NarrationCache", () => {
  test("uses ArrayBuffer byteLength as cache size", () => {
    const cache = new NarrationCache({ maxItems: 10, maxBytes: 5 });
    const first = new ArrayBuffer(3);
    const second = new ArrayBuffer(3);

    cache.set("first", first);
    cache.set("second", second);

    expect(cache.get("first")).toBeNull();
    expect(cache.get("second")).toBe(second);
  });
});
