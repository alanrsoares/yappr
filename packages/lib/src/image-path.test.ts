import { describe, expect, test } from "bun:test";

import {
  imageMimeForPath,
  looksLikeImagePath,
  normalizeImagePath,
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
