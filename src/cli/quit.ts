import { stopAudioPlayback } from "./services/yappr";

/** Terminal cleanup (`cleanupTerminalModesSync`) is registered on `process.on("exit")` in `app.tsx`; keep `quit()` to stopping audio then exiting so cleanup runs once. */
export function quit(): never {
  stopAudioPlayback();
  process.exit(0);
}
