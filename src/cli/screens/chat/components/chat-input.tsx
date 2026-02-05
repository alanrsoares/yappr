import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: ChatInputProps) {
  return (
    <Box flexDirection="row" alignItems="center">
      <Text color="cyan">› </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
