import type { ReactNode } from "react";
import { Box, Text } from "ink";

import type { ChatMessage } from "~/cli/types.js";
import { MessageBubble } from "./message-bubble.js";

export interface ChatHistoryProps {
  messages: ChatMessage[];
  streamingResponse: string;
  modelName: string;
  statusContent: ReactNode;
  showStatusLine: boolean;
}

export function ChatHistory({
  messages,
  streamingResponse,
  modelName,
  statusContent,
  showStatusLine,
}: ChatHistoryProps) {
  const isEmpty =
    messages.length === 0 && !streamingResponse && !showStatusLine;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={1}
      minHeight={8}
      flexDirection="column"
      marginBottom={1}
    >
      {isEmpty && <Text dimColor>No messages yet. Send a message below.</Text>}
      {messages.map((msg, i) => (
        <MessageBubble
          key={`${i}-${msg.role}-${msg.content.slice(0, 12)}`}
          role={msg.role as "user" | "assistant"}
          content={msg.content}
          label={msg.role === "user" ? "You" : modelName}
          borderColor={msg.role === "user" ? "green" : "cyan"}
        />
      ))}
      {streamingResponse && (
        <MessageBubble
          role="assistant"
          content={streamingResponse}
          label={`${modelName} (streaming…)`}
          borderColor="cyan"
        />
      )}
      {showStatusLine && <Box marginTop={1}>{statusContent}</Box>}
    </Box>
  );
}
