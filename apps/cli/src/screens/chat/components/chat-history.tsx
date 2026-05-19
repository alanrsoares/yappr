import { Box, Static, Text } from "ink";

import { useTerminalHeight, useTerminalWidth } from "~/hooks";
import {
  bubbleBorderForRole,
  streamingBubbleBorder,
} from "~/theme/chat-appearance.js";
import type { ChatMessage } from "~/types.js";
import { MessageBubble } from "./message-bubble.js";

export interface ChatHistoryProps {
  messages: ChatMessage[];
  streamingResponse: string;
  modelName: string;
}

const BUBBLE_OVERHEAD_ROWS = 4;
const NON_HISTORY_ROWS = 12;
const MIN_STREAM_ROWS = 4;

function wrapToRows(content: string, innerCols: number): string[] {
  const cols = Math.max(1, innerCols);
  const rows: string[] = [];
  for (const line of content.split("\n")) {
    if (line.length === 0) {
      rows.push("");
      continue;
    }
    for (let i = 0; i < line.length; i += cols) {
      rows.push(line.slice(i, i + cols));
    }
  }
  return rows;
}

function tailContent(content: string, maxRows: number, innerCols: number) {
  const rows = wrapToRows(content, innerCols);
  if (rows.length <= maxRows) return content;
  const keep = Math.max(1, maxRows - 1);
  return ["…", ...rows.slice(rows.length - keep)].join("\n");
}

export function ChatHistory({
  messages,
  streamingResponse,
  modelName,
}: ChatHistoryProps) {
  const isEmpty = messages.length === 0 && !streamingResponse;
  const termRows = useTerminalHeight();
  const termCols = useTerminalWidth();
  const innerCols = Math.max(8, termCols - 8);
  const streamBudgetRows = Math.max(
    MIN_STREAM_ROWS,
    termRows - NON_HISTORY_ROWS - BUBBLE_OVERHEAD_ROWS,
  );
  const streamContent = streamingResponse
    ? tailContent(streamingResponse, streamBudgetRows, innerCols)
    : null;

  return (
    <Box flexDirection="column" flexShrink={0}>
      {isEmpty && (
        <Box flexDirection="column" paddingY={1} gap={0}>
          <Text bold>No messages yet</Text>
          <Text dimColor>
            Type below or use ctrl+t for voice. Replies are read aloud (TTS).
          </Text>
        </Box>
      )}

      <Static items={messages.map((msg, i) => ({ msg, i }))}>
        {({ msg, i }) => (
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

      {streamContent !== null && (
        <MessageBubble
          role="assistant"
          content={streamContent}
          label={`${modelName} (streaming…)`}
          borderColor={streamingBubbleBorder()}
        />
      )}
    </Box>
  );
}
