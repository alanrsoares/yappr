import { describe, expect, test } from "bun:test";

import {
  findInsertedImagePath,
  formatImageToken,
  imageMimeForPath,
  looksLikeImagePath,
  normalizeImagePath,
  parseImageTokens,
} from "./image-path";

describe("normalizeImagePath", () => {
  test("trims whitespace", () => {
    expect(normalizeImagePath("  /tmp/a.png  ")).toBe("/tmp/a.png");
  });

  test("strips surrounding quotes", () => {
    expect(normalizeImagePath('"/tmp/a.png"')).toBe("/tmp/a.png");
    expect(normalizeImagePath("'/tmp/a.png'")).toBe("/tmp/a.png");
    expect(normalizeImagePath("`/tmp/a.png`")).toBe("/tmp/a.png");
  });

  test("unescapes backslash-escaped spaces from Terminal drag-drop", () => {
    expect(normalizeImagePath("/tmp/foo\\ bar.png")).toBe("/tmp/foo bar.png");
  });

  test("decodes file:// URLs", () => {
    expect(normalizeImagePath("file:///tmp/a%20b.png")).toBe("/tmp/a b.png");
  });

  test("handles malformed file:// URLs", () => {
    expect(normalizeImagePath("file:///tmp/%E0.png")).toBe(
      "file:///tmp/%E0.png",
    );
  });
});

describe("looksLikeImagePath", () => {
  test("accepts common image extensions", () => {
    expect(looksLikeImagePath("/tmp/a.png")).toBe(true);
    expect(looksLikeImagePath("/tmp/a.JPG")).toBe(true);
    expect(looksLikeImagePath("/tmp/a.jpeg")).toBe(true);
    expect(looksLikeImagePath("/tmp/a.gif")).toBe(true);
    expect(looksLikeImagePath("/tmp/a.webp")).toBe(true);
    expect(looksLikeImagePath("/tmp/a.bmp")).toBe(true);
  });

  test("rejects non-image extensions", () => {
    expect(looksLikeImagePath("/tmp/a.txt")).toBe(false);
    expect(looksLikeImagePath("hello world")).toBe(false);
  });

  test("works through Terminal-escaped paths", () => {
    expect(looksLikeImagePath("/Users/x/Desktop/Screenshot\\ 2026.png")).toBe(
      true,
    );
  });
});

describe("formatImageToken", () => {
  test("emits [Image #N]", () => {
    expect(formatImageToken(1)).toBe("[Image #1]");
    expect(formatImageToken(42)).toBe("[Image #42]");
  });
});

describe("parseImageTokens", () => {
  test("extracts tokens in order, dedupes", () => {
    const result = parseImageTokens(
      "look at [Image #1] then [Image #2] (and [Image #1] again)",
      ["/a.png", "/b.png"],
    );
    expect(result.images).toEqual(["/a.png", "/b.png"]);
    expect(result.prompt).toBe("look at then (and again)");
  });

  test("drops tokens that reference out-of-range indices", () => {
    const result = parseImageTokens("describe [Image #1] and [Image #5]", [
      "/a.png",
    ]);
    expect(result.images).toEqual(["/a.png"]);
    expect(result.prompt).toBe("describe and");
  });

  test("returns empty images when text has no tokens", () => {
    const result = parseImageTokens("hello world", ["/a.png"]);
    expect(result.images).toEqual([]);
    expect(result.prompt).toBe("hello world");
  });
});

describe("findInsertedImagePath", () => {
  test("detects a path inserted into empty composer", () => {
    const r = findInsertedImagePath("", "/tmp/a.png");
    expect(r).toEqual({ path: "/tmp/a.png", startIdx: 0, endIdx: 10 });
  });

  test("detects a path appended after existing text", () => {
    const r = findInsertedImagePath("hi ", "hi /tmp/a.png");
    expect(r).toEqual({ path: "/tmp/a.png", startIdx: 3, endIdx: 13 });
  });

  test("normalizes Terminal-escaped paths in delta", () => {
    const r = findInsertedImagePath("describe ", "describe /tmp/foo\\ bar.png");
    expect(r?.path).toBe("/tmp/foo bar.png");
  });

  test("returns null when delta isn't an image path", () => {
    expect(findInsertedImagePath("hi", "hi there")).toBeNull();
  });

  test("returns null on deletion or unchanged input", () => {
    expect(findInsertedImagePath("hello", "hi")).toBeNull();
    expect(findInsertedImagePath("a", "a")).toBeNull();
  });
});

describe("imageMimeForPath", () => {
  test("returns mime by extension", () => {
    expect(imageMimeForPath("/x/a.png")).toBe("image/png");
    expect(imageMimeForPath("/x/a.JPG")).toBe("image/jpeg");
    expect(imageMimeForPath("/x/a.jpeg")).toBe("image/jpeg");
    expect(imageMimeForPath("/x/a.gif")).toBe("image/gif");
    expect(imageMimeForPath("/x/a.webp")).toBe("image/webp");
    expect(imageMimeForPath("/x/a.bmp")).toBe("image/bmp");
  });

  test("returns null for unknown extension", () => {
    expect(imageMimeForPath("/x/a.tiff")).toBeNull();
    expect(imageMimeForPath("/x/noext")).toBeNull();
  });
});
