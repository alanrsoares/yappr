import { useCallback, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { okAsync } from "neverthrow";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, useMutation } from "~/cli/hooks";
import { chat, speak } from "~/cli/services/yappr.js";

export interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [value, setValue] = useState("");
  const chatMutation = useMutation<string | null, Error, string>((prompt) =>
    chat(prompt).andThen((text) =>
      text ? speak(text).map(() => text) : okAsync(null),
    ),
  );
  const { mutate, data: response, error, isPending } = chatMutation;

  const handleSubmit = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      mutate(prompt.trim());
      setValue("");
    },
    [mutate],
  );

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Chat" subtitle="Prompt Ollama (with MCP tools) + TTS" />
      <Box>
        <Text color="cyan">Prompt: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Ask something..."
        />
      </Box>
      {isPending && <Loading message="Waiting for Ollama..." />}
      {chatMutation.isSuccess && response !== undefined && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Ollama:</Text>
          <Text>{response ?? "(no response)"}</Text>
        </Box>
      )}
      {chatMutation.isError && error && (
        <Text color="red">{error.message}</Text>
      )}
      <Footer
        items={[
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
