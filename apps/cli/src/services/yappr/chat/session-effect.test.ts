import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import { okAsync } from "neverthrow";

import type { ChatRuntime } from "./runtime.js";
import { acquireMcp, ChatRuntimeTag } from "./session-effect.js";

function fakeRuntime(closed: { value: boolean }): ChatRuntime {
  const mcp = {
    loadConfigAndGetStatuses: () => okAsync([]),
    getTanStackTools: () => [],
    close: () => {
      closed.value = true;
      return Promise.resolve();
    },
  };
  // ponytail: acquireMcp only touches createMcpManager; the rest of the
  // ChatRuntime surface is irrelevant to this resource-lifecycle test.
  return { createMcpManager: () => mcp } as unknown as ChatRuntime;
}

describe("acquireMcp (Effect Scope)", () => {
  it("closes the MCP manager even when the scoped program fails", async () => {
    const closed = { value: false };
    const program = Effect.scoped(
      Effect.gen(function* () {
        yield* acquireMcp("x");
        return yield* Effect.fail(new Error("boom"));
      }),
    ).pipe(Effect.provideService(ChatRuntimeTag, fakeRuntime(closed)));

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    expect(closed.value).toBe(true); // released despite the failure
  });

  it("closes the MCP manager on success", async () => {
    const closed = { value: false };
    const program = Effect.scoped(acquireMcp("x")).pipe(
      Effect.provideService(ChatRuntimeTag, fakeRuntime(closed)),
    );

    await Effect.runPromise(program);

    expect(closed.value).toBe(true);
  });
});
