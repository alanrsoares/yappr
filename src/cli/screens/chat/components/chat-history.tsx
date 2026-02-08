import { Box, Static, Text } from "ink";

import type { ChatMessage } from "~/cli/types.js";
import { MessageBubble } from "./message-bubble.js";

export interface ChatHistoryProps {
  messages: ChatMessage[];
  streamingResponse: string;
  modelName: string;
}

export function ChatHistory({
  messages,
  streamingResponse,
  modelName,
}: ChatHistoryProps) {
  const isEmpty = messages.length === 0 && !streamingResponse;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {isEmpty && (
        <Box paddingY={1}>
          <Text dimColor>No messages yet. Send a message below.</Text>
        </Box>
      )}

      {/* Static history for completed messages */}
      <Static items={messages}>
        {(msg, i) => (
          <MessageBubble
            key={`${i}-${msg.role}-${msg.content.slice(0, 12)}`}
            role={msg.role as "user" | "assistant"}
            content={msg.content}
            label={msg.role === "user" ? "You" : modelName}
            borderColor={msg.role === "user" ? "green" : "cyan"}
          />
        )}
      </Static>

      {/* Dynamic section for streaming response */}
      {streamingResponse && (
        <MessageBubble
          role="assistant"
          content={streamingResponse}
          label={`${modelName} (streaming…)`}
          borderColor="cyan"
        />
      )}
    </Box>
  );
}
