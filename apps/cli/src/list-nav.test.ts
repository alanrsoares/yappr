import { describe, expect, test } from "bun:test";

import { clampSelectedIndex, cycleIndex } from "./list-nav.js";

describe("cycleIndex", () => {
  test("wraps forward", () => {
    expect(cycleIndex(0, 5, 1)).toBe(1);
    expect(cycleIndex(4, 5, 1)).toBe(0);
  });
  test("wraps backward", () => {
    expect(cycleIndex(0, 5, -1)).toBe(4);
    expect(cycleIndex(3, 5, -1)).toBe(2);
  });
  test("empty list", () => {
    expect(cycleIndex(3, 0, 1)).toBe(0);
  });
});

describe("clampSelectedIndex", () => {
  test("clamps to bounds", () => {
    expect(clampSelectedIndex(10, 5)).toBe(4);
    expect(clampSelectedIndex(-1, 5)).toBe(0);
  });
  test("empty list", () => {
    expect(clampSelectedIndex(3, 0)).toBe(0);
  });
});
