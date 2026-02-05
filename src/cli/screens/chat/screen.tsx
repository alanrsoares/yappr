import { useCallback, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { okAsync } from "neverthrow";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, useMutation, usePreferences } from "~/cli/hooks";
import { chat, speak } from "~/cli/services/yappr.js";

type ChatPhase = "idle" | "thinking" | "speaking";

export interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const { preferences } = usePreferences();
  const model = preferences.defaultOllamaModel;
  const voice = preferences.defaultVoice;

  const chatMutation = useMutation<string | null, Error, string>((prompt) => {
    setPhase("thinking");
    return chat(prompt, { model })
      .andThen((text) => {
        if (!text) {
          setPhase("idle");
          return okAsync(null);
        }
        setPhase("speaking");
        return speak(text, { voice }).map(() => text);
      })
      .andTee(() => setPhase("idle"))
      .orTee(() => setPhase("idle"));
  });
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

  const hasResponse = chatMutation.isSuccess && response !== undefined;
  const showError = chatMutation.isError && error;

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Chat"
        subtitle={`Model: ${model}  ·  Voice: ${voice}`}
      />

      <Box
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
        minHeight={3}
        flexDirection="column"
        marginBottom={1}
      >
        {isPending && phase === "thinking" && (
          <Loading message="Thinking…" />
        )}
        {isPending && phase === "speaking" && (
          <Loading message="Speaking…" />
        )}
        {!isPending && hasResponse && (
          <Box flexDirection="column">
            <Text dimColor>Response:</Text>
            <Text>{response ?? "(no response)"}</Text>
          </Box>
        )}
        {!isPending && showError && (
          <Text color="red">{error?.message}</Text>
        )}
        {!isPending && !hasResponse && !showError && (
          <Text dimColor>Ask anything — reply is read aloud with TTS.</Text>
        )}
      </Box>

      <Box flexDirection="row" alignItems="center">
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={`Ask ${model}…`}
        />
      </Box>

      <Footer
        items={[
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
