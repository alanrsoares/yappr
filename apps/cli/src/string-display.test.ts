import { expect, test } from "bun:test";

import { truncateDisplayWidth } from "./string-display.js";

test("truncateDisplayWidth leaves short strings unchanged", () => {
  expect(truncateDisplayWidth("hello", 10)).toBe("hello");
});

test("truncateDisplayWidth fits body plus ellipsis within maxCols", () => {
  expect(truncateDisplayWidth("abcde", 4)).toBe("abc…");
});
