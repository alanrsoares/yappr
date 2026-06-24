import { chat as tanstackChat } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { McpManager } from "@yappr/sdk/mcp";

import { getOllamaClient } from "../ollama.js";

export interface ChatRuntime {
  createMcpManager: () => McpManager;
  tanstackChat: typeof tanstackChat;
  createOllamaChat: typeof createOllamaChat;
  createOpenRouterText: typeof createOpenRouterText;
  getOllamaClient: typeof getOllamaClient;
}

export const createDefaultChatRuntime = (): ChatRuntime => ({
  createMcpManager: () => new McpManager(),
  tanstackChat,
  createOllamaChat,
  createOpenRouterText,
  getOllamaClient,
});

export const defaultChatRuntime: ChatRuntime = createDefaultChatRuntime();
