import { highlight } from "cli-highlight";
import { Box, Text } from "ink";
import Markdown from "ink-markdown";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  label: string;
  borderColor: "green" | "cyan" | "gray";
}

export function MessageBubble({
  content,
  label,
  borderColor,
}: MessageBubbleProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={0} marginLeft={1}>
        <Text bold color={borderColor}>
          {label}
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        paddingY={0}
      >
        <Markdown
          code={(code: string, lang?: string) => {
            // Check if lang is valid string, otherwise undefined to let auto-detect or default
            const language = lang && lang.trim() ? lang.trim() : undefined;
            try {
              return highlight(code, { language, ignoreIllegals: true });
            } catch {
              return code;
            }
          }}
        >
          {content}
        </Markdown>
      </Box>
    </Box>
  );
}
