/** Per-turn chat telemetry, derived from the stream's final usage + timing. */
export interface TurnTelemetry {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** End-to-end latency of the turn, in milliseconds. */
  latencyMs: number;
  /** Provider-reported cost in USD, when available (cloud providers). */
  cost?: number;
}

const formatLatency = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

/**
 * Compact one-line stats string for after an assistant reply, e.g.
 * `↑8 ↓23 · 1.2s · 19 tok/s` (local) or `↑8 ↓23 · 1.2s · $0.0001` (cloud).
 * Shows cost when the provider reports it, otherwise tokens/sec.
 */
export function formatTelemetry(t: TurnTelemetry): string {
  const parts = [
    `↑${t.promptTokens} ↓${t.completionTokens}`,
    formatLatency(t.latencyMs),
  ];
  if (typeof t.cost === "number" && t.cost > 0) {
    parts.push(`$${t.cost.toFixed(4)}`);
  } else if (t.completionTokens > 0 && t.latencyMs > 0) {
    parts.push(
      `${Math.round(t.completionTokens / (t.latencyMs / 1000))} tok/s`,
    );
  }
  return parts.join(" · ");
}
