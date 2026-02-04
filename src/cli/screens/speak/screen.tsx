import { useCallback, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, useMutation } from "~/cli/hooks";
import { speak } from "~/cli/services/yappr.js";

export interface SpeakScreenProps {
  onBack: () => void;
}

export function SpeakScreen({ onBack }: SpeakScreenProps) {
  const [value, setValue] = useState("");
  const speakMutation = useMutation<void, Error, string>(speak);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      speakMutation.mutate(text.trim());
      setValue("");
    },
    [speakMutation],
  );

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Speak"
        subtitle="Type text and press Enter to synthesize"
      />
      <Box>
        <Text color="cyan">Text: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Enter text to speak..."
        />
      </Box>
      {speakMutation.isPending && <Loading message="Synthesizing..." />}
      {speakMutation.isSuccess && <Text color="green">Done. Playing.</Text>}
      {speakMutation.isError && speakMutation.error && (
        <Text color="red">{speakMutation.error.message}</Text>
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
