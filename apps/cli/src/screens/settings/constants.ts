import type { PickerKind } from "./store.js";

export const SETTINGS_SUBTITLE = "~/.yappr/settings.json";

export const PICKER_TITLES: Record<Exclude<PickerKind, null>, string> = {
  provider: "Choose chat provider",
  model: "Choose Ollama model",
  openRouterModel: "Choose OpenRouter model (text + tools)",
  voice: "Choose voice",
  input: "Choose input device",
  output: "Choose output device",
  narrationModel: "Choose narration model (for TTS)",
};
