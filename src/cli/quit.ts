import { stopAudioPlayback } from "./services/yappr.js";

export function quit(): never {
  stopAudioPlayback();
  process.exit(0);
}
