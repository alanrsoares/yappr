// Re-export shared state types from the SDK so existing `~/types` imports keep
// working. New code can import directly from `@yappr/sdk/state`.
export type { HealthState, TtsState } from "@yappr/sdk/state";
