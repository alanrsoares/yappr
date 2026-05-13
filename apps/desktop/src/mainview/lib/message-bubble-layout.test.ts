import { describe, expect, test } from "bun:test";

import {
  measureUserTextBubbleWidth,
  normalizeBubbleText,
} from "./message-bubble-layout";

const installMeasureShim = () => {
  if ("OffscreenCanvas" in globalThis) return;
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: class {
      getContext(kind: string) {
        if (kind !== "2d") return null;
        return {
          font: "",
          measureText: (text: string) => ({
            width: Array.from(text).length * 8,
          }),
        } as OffscreenCanvasRenderingContext2D;
      }
    },
  });
};

installMeasureShim();

describe("normalizeBubbleText", () => {
  test("trims and normalizes newlines", () => {
    expect(normalizeBubbleText("  hello\r\n\r\n\r\nworld  ")).toBe(
      "hello\n\nworld",
    );
  });
});

describe("measureUserTextBubbleWidth", () => {
  test("returns null for empty or impossible input", () => {
    expect(measureUserTextBubbleWidth("   ", 300)).toBeNull();
    expect(measureUserTextBubbleWidth("hello", 16)).toBeNull();
  });

  test("shrinkwraps below the max bubble width", () => {
    const width = measureUserTextBubbleWidth(
      "short text that should not need the full bubble width",
      360,
    );

    expect(width).toBeGreaterThan(32);
    expect(width).toBeLessThan(360);
  });

  test("stays within max bubble width for long unbroken input", () => {
    const width = measureUserTextBubbleWidth("x".repeat(200), 240);

    expect(width).toBeGreaterThan(32);
    expect(width).toBeLessThanOrEqual(240);
  });
});
