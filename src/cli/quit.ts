import { stopAudioPlayback } from "./services/yappr";
import { cleanupTerminalModesSync } from "./terminal-cleanup.js";

export function quit(): never {
  stopAudioPlayback();
  cleanupTerminalModesSync();
  process.exit(0);
}
