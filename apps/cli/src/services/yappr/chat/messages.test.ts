import { describe, expect, test } from "bun:test";

import { buildChatModelMessages } from "./messages.js";

describe("buildChatModelMessages", () => {
  test("drops prior system messages and appends user prompt", () => {
    const out = buildChatModelMessages("hello", [
      { role: "system", content: "ignored" },
      { role: "user", content: "prior" },
      { role: "assistant", content: "reply" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "prior" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "hello" },
    ]);
  });

  test("defaults missing content to empty string", () => {
    const out = buildChatModelMessages("x", [
      { role: "user", content: "" },
      { role: "assistant", content: undefined as unknown as string },
    ]);
    expect(out[0]?.content).toBe("");
    expect(out[1]?.content).toBe("");
  });
});
