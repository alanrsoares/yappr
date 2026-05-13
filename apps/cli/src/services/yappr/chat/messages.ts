import type { ModelMessage } from "@tanstack/ai";

import type { ChatMessage } from "../../../types.js";

export function buildChatModelMessages(
  prompt: string,
  priorMessages: ChatMessage[],
): Array<ModelMessage<string>> {
  const priorWithoutSystem = priorMessages.filter((m) => m.role !== "system");
  return [
    ...priorWithoutSystem.map(
      (m): ModelMessage<string> => ({
        role: m.role as ModelMessage["role"],
        content: m.content ?? "",
      }),
    ),
    { role: "user", content: prompt },
  ];
}
