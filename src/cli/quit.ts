import { stopAudioPlayback } from "./services/yappr";

export function quit(): never {
  stopAudioPlayback();
  process.exit(0);
}
