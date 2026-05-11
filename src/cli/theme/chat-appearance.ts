import { semantic } from "./semantic.js";

export type ChatBubbleRole = "user" | "assistant";

/** Border (and label) color for a completed message bubble by role. */
export const bubbleBorderForRole = (role: ChatBubbleRole) =>
  role === "user"
    ? semantic.border.userBubble
    : semantic.border.assistantBubble;

/** Border color for the in-flight streaming assistant block. */
export const streamingBubbleBorder = () => semantic.border.streaming;
