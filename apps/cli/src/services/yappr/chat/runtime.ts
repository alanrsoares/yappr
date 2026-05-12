import { chat as tanstackChat } from "@tanstack/ai";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { McpManager } from "@yappr/sdk/mcp";

import { getOllamaClient } from "../ollama.js";
import {
  createOpenRouterChat,
  fetchOpenRouterChatCompletion,
} from "../openrouter.js";

export interface ChatRuntime {
  createMcpManager: () => McpManager;
  tanstackChat: typeof tanstackChat;
  createOllamaChat: typeof createOllamaChat;
  getOllamaClient: typeof getOllamaClient;
  createOpenRouterChat: typeof createOpenRouterChat;
  fetchOpenRouterChatCompletion: typeof fetchOpenRouterChatCompletion;
}

export function createDefaultChatRuntime(): ChatRuntime {
  return {
    createMcpManager: () => new McpManager(),
    tanstackChat,
    createOllamaChat,
    getOllamaClient,
    createOpenRouterChat,
    fetchOpenRouterChatCompletion,
  };
}

export const defaultChatRuntime: ChatRuntime = createDefaultChatRuntime();
