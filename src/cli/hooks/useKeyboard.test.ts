import { expect, test } from "bun:test";

import { getEffectiveKey, type ExtendedKey } from "./useKeyboard";

function key(overrides: Partial<ExtendedKey> = {}): ExtendedKey {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    return: false,
    escape: false,
    tab: false,
    backspace: false,
    delete: false,
    ctrl: false,
    shift: false,
    meta: false,
    // function keys default to false
    f1: false,
    f2: false,
    f3: false,
    f4: false,
    f5: false,
    f6: false,
    f7: false,
    f8: false,
    f9: false,
    f10: false,
    f11: false,
    f12: false,
    ...overrides,
  };
}

test("getEffectiveKey maps special keys", () => {
  expect(getEffectiveKey("", key({ escape: true }))).toBe("escape");
  expect(getEffectiveKey("", key({ return: true }))).toBe("return");
  expect(getEffectiveKey("", key({ upArrow: true }))).toBe("upArrow");
  expect(getEffectiveKey("", key({ downArrow: true }))).toBe("downArrow");
  expect(getEffectiveKey("", key({ tab: true }))).toBe("tab");
  expect(getEffectiveKey("", key({ backspace: true }))).toBe("backspace");
  expect(getEffectiveKey("", key({ delete: true }))).toBe("delete");
});

test("getEffectiveKey maps function keys f1-f12", () => {
  expect(getEffectiveKey("", key({ f1: true }))).toBe("f1");
  expect(getEffectiveKey("", key({ f5: true }))).toBe("f5");
  expect(getEffectiveKey("", key({ f12: true }))).toBe("f12");
});

test("getEffectiveKey maps ctrl+<char> combinations", () => {
  expect(getEffectiveKey("T", key({ ctrl: true }))).toBe("ctrl+t");
  expect(getEffectiveKey("v", key({ ctrl: true }))).toBe("ctrl+v");
});

test("getEffectiveKey falls back to raw input when no special mapping", () => {
  expect(getEffectiveKey("a", key())).toBe("a");
  expect(getEffectiveKey("Z", key())).toBe("Z");
});

