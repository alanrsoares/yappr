import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import { errAsync, okAsync } from "neverthrow";

import { fromResultAsync, toResultAsync } from "./effect.js";

describe("fromResultAsync", () => {
  it("lifts ok into a succeeding Effect", async () => {
    const value = await Effect.runPromise(fromResultAsync(okAsync(5)));
    expect(value).toBe(5);
  });

  it("lifts err into the Effect error channel", async () => {
    const err = new Error("nope");
    const exit = await Effect.runPromiseExit(fromResultAsync(errAsync(err)));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("toResultAsync", () => {
  it("maps a succeeding Effect to ok", async () => {
    const result = await toResultAsync(Effect.succeed(5));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(5);
  });

  it("maps a failing Effect to err(Error)", async () => {
    const result = await toResultAsync(Effect.fail(new Error("boom")));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("boom");
  });

  it("collapses a defect to err(Error)", async () => {
    const result = await toResultAsync(Effect.die(new Error("defect")));
    expect(result.isErr()).toBe(true);
  });

  it("round-trips through both bridges", async () => {
    const result = await toResultAsync(fromResultAsync(okAsync("hi")));
    expect(result._unsafeUnwrap()).toBe("hi");
  });
});
