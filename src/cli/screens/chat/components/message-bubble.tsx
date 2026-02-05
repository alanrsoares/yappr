import { Box, Text } from "ink";

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
    <Box marginBottom={1} flexDirection="column">
      <Text dimColor>{label}</Text>
      <Box
        borderStyle="single"
        borderColor={borderColor}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text>{content}</Text>
      </Box>
    </Box>
  );
}
