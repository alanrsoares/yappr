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
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexDirection="row"
      alignItems="center"
    >
      <Box marginRight={1}>
        <Text color="green" bold>
          ›
        </Text>
      </Box>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
