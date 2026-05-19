import { readFileSync } from "node:fs";
import type { ContentPart, ModelMessage } from "@tanstack/ai";
import { imageMimeForPath } from "@yappr/lib/image-path";

import type { ChatMessage } from "../../../types.js";

function imageToPart(path: string): ContentPart | null {
  try {
    const mime = imageMimeForPath(path);
    if (!mime) return null;
    const buf = readFileSync(path);
    return {
      type: "image",
      source: { type: "data", value: buf.toString("base64"), mimeType: mime },
    };
  } catch {
    return null;
  }
}

function buildMessage(msg: ChatMessage): ModelMessage {
  const images = msg.images ?? [];
  if (images.length === 0) {
    return {
      role: msg.role as ModelMessage["role"],
      content: msg.content ?? "",
    };
  }
  const parts: ContentPart[] = [];
  if (msg.content) parts.push({ type: "text", content: msg.content });
  for (const path of images) {
    const part = imageToPart(path);
    if (part) parts.push(part);
  }
  return {
    role: msg.role as ModelMessage["role"],
    content: parts,
  };
}

export function buildChatModelMessages(
  prompt: string,
  priorMessages: ChatMessage[],
  images: string[] = [],
): ModelMessage[] {
  const priorWithoutSystem = priorMessages.filter((m) => m.role !== "system");
  const current: ChatMessage = { role: "user", content: prompt, images };
  return [...priorWithoutSystem.map(buildMessage), buildMessage(current)];
}
