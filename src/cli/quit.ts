/**
 * Central quit handler: stops any audio playback (and optionally other teardown)
 * then exits the process. Use this instead of process.exit(0) so TTS/recording
 * is aborted cleanly.
 */
import { stopAudioPlayback } from "./services/yappr.js";

export function quit(): never {
  stopAudioPlayback();
  process.exit(0);
}
