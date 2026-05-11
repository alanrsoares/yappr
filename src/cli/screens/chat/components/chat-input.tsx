import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { SlashCommandInput } from "./slash-command-input.js";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onComposerSubmit: (raw: string, slashPick?: string) => void;
  placeholder: string;
}

export function ChatInput({
  value,
  onChange,
  onComposerSubmit,
  placeholder,
}: ChatInputProps) {
  const isSlash = value.startsWith("/");

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="row"
      alignItems={isSlash ? "flex-start" : "center"}
      marginBottom={0}
    >
      <Box marginRight={1}>
        <Text color="cyan" bold>
          ›
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {isSlash ? (
          <SlashCommandInput
            value={value}
            onChange={onChange}
            onSubmitLine={(line, explicit) => onComposerSubmit(line, explicit)}
          />
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={(v) => onComposerSubmit(v)}
            placeholder={placeholder}
          />
        )}
      </Box>
    </Box>
  );
}
