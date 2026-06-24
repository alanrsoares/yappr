import type { ChatProvider } from "~/types.js";

export function chatModelRowText(p: {
  defaultChatProvider: ChatProvider;
  openRouterModelsLoading: boolean;
  modelsLoading: boolean;
  defaultChatModel: string;
}): string {
  if (p.defaultChatProvider === "openrouter") {
    return p.openRouterModelsLoading
      ? "…"
      : p.defaultChatModel || "(set API key, then pick model)";
  }
  if (p.modelsLoading) return "…";
  return p.defaultChatModel;
}
