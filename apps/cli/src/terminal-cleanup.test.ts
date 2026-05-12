import { afterEach, describe, expect, test } from "bun:test";

import { alternateScreenAllowedByEnv } from "./terminal-cleanup.js";

describe("alternateScreenAllowedByEnv", () => {
  const prev = process.env.YAPPR_ALT_SCREEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.YAPPR_ALT_SCREEN;
    else process.env.YAPPR_ALT_SCREEN = prev;
  });

  test("allows when unset", () => {
    delete process.env.YAPPR_ALT_SCREEN;
    expect(alternateScreenAllowedByEnv()).toBe(true);
  });

  test("disables for 0 false no off", () => {
    for (const v of ["0", "false", "no", "off", "FALSE", " NO "]) {
      process.env.YAPPR_ALT_SCREEN = v;
      expect(alternateScreenAllowedByEnv()).toBe(false);
    }
  });

  test("allows other values", () => {
    process.env.YAPPR_ALT_SCREEN = "1";
    expect(alternateScreenAllowedByEnv()).toBe(true);
  });
});
