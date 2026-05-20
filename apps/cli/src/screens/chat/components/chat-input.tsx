import { Box, Text } from "ink";

import { CursorTextInput } from "~/components/cursor-text-input.js";
import { semantic } from "~/theme/semantic.js";
import { SlashCommandInput } from "./slash-command-input.js";

export interface ChatInputProps {
  value: string;
  cursor: number;
  onChange: (value: string, cursor: number) => void;
  onComposerSubmit: (raw: string, slashPick?: string) => void;
  placeholder: string;
}

export function ChatInput({
  value,
  cursor,
  onChange,
  onComposerSubmit,
  placeholder,
}: ChatInputProps) {
  const isSlash = value.startsWith("/");

  return (
    <Box
      borderStyle="round"
      borderColor={semantic.border.composer}
      paddingX={1}
      flexDirection="row"
      alignItems={isSlash ? "flex-start" : "center"}
      marginBottom={0}
    >
      <Box marginRight={1}>
        <Text color={semantic.accent} bold>
          ›
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {isSlash ? (
          <SlashCommandInput
            value={value}
            onChange={(v) => onChange(v, v.length)}
            onSubmitLine={(line, explicit) => onComposerSubmit(line, explicit)}
          />
        ) : (
          <CursorTextInput
            value={value}
            cursor={cursor}
            onChange={onChange}
            onSubmit={(v) => onComposerSubmit(v)}
            placeholder={placeholder}
          />
        )}
      </Box>
    </Box>
  );
}
