import { Box, Static, Text } from "ink";

import {
  bubbleBorderForRole,
  streamingBubbleBorder,
} from "~/cli/theme/chat-appearance.js";
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
    <Box flexDirection="column" marginBottom={0}>
      {isEmpty && (
        <Box flexDirection="column" paddingY={1} gap={0}>
          <Text bold>No messages yet</Text>
          <Text dimColor>
            Type below or use ctrl+t for voice. Replies are read aloud (TTS).
          </Text>
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
            borderColor={bubbleBorderForRole(
              msg.role === "user" ? "user" : "assistant",
            )}
          />
        )}
      </Static>

      {/* Dynamic section for streaming response */}
      {streamingResponse && (
        <MessageBubble
          role="assistant"
          content={streamingResponse}
          label={`${modelName} (streaming…)`}
          borderColor={streamingBubbleBorder()}
        />
      )}
    </Box>
  );
}
