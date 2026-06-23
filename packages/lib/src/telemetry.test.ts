import { describe, expect, it } from "bun:test";

import { formatTelemetry } from "./telemetry.js";

describe("formatTelemetry", () => {
  it("shows tokens, latency, and tokens/sec for local turns (no cost)", () => {
    expect(
      formatTelemetry({
        promptTokens: 8,
        completionTokens: 20,
        totalTokens: 28,
        latencyMs: 1000,
      }),
    ).toBe("↑8 ↓20 · 1.0s · 20 tok/s");
  });

  it("shows cost instead of tokens/sec when the provider reports it", () => {
    expect(
      formatTelemetry({
        promptTokens: 8,
        completionTokens: 23,
        totalTokens: 31,
        latencyMs: 623,
        cost: 0.000_146,
      }),
    ).toBe("↑8 ↓23 · 623ms · $0.0001");
  });

  it("omits tokens/sec when no completion tokens were produced", () => {
    expect(
      formatTelemetry({
        promptTokens: 5,
        completionTokens: 0,
        totalTokens: 5,
        latencyMs: 200,
      }),
    ).toBe("↑5 ↓0 · 200ms");
  });
});
