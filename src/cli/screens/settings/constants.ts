import type { FooterItem } from "~/cli/components";
import type { PickerKind } from "./store.js";

export const SETTINGS_SUBTITLE = "~/.yappr/settings.json";

export const EDIT_MODE_FOOTER_ITEMS: FooterItem[] = [
  { key: "Esc", label: "cancel" },
  { key: "Ctrl+s", label: "save" },
  { key: "Ctrl+q", label: "quit" },
];

export const LIST_FOOTER_ITEMS: FooterItem[] = [
  { key: "Esc", label: "back" },
  { key: "Ctrl+q", label: "quit" },
];

export const PICKER_TITLES: Record<Exclude<PickerKind, null>, string> = {
  provider: "Choose chat provider",
  model: "Choose Ollama model",
  openRouterModel: "Choose OpenRouter model (text + tools)",
  voice: "Choose voice",
  input: "Choose input device",
  output: "Choose output device",
  narrationModel: "Choose narration model (for TTS)",
};
