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
        <Text>{content}</Text>
      </Box>
    </Box>
  );
}
