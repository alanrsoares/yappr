/**
 * Desktop Yappr service façade — use this path like the CLI uses `~/services/yappr`.
 * CLI wires Kokoro through the Bun audio runtime; the webview uses HTTP via {@link TTSClient}.
 */
export { TTSClient } from "@yappr/sdk/tts";
export type { VoiceId } from "@yappr/sdk/schemas";
