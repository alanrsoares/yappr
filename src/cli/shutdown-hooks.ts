import { stopAudioPlayback } from "./services/yappr/index.js";

/**
 * SIGINT/SIGTERM: stop audio then exit — `process.on("exit")` in `app.tsx` runs
 * `cleanupTerminalModesSync` (leave alternate screen + reset modes). Do not call
 * cleanup here to avoid double emission.
 */
export function registerSignalHandlers(): void {
  const onSigInt = () => {
    stopAudioPlayback();
    process.exit(130);
  };
  const onSigTerm = () => {
    stopAudioPlayback();
    process.exit(143);
  };

  if (typeof process.prependOnceListener === "function") {
    process.prependOnceListener("SIGINT", onSigInt);
    process.prependOnceListener("SIGTERM", onSigTerm);
  } else {
    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigTerm);
  }
}
