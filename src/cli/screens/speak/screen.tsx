import { useCallback, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { FOOTER_SPEAK } from "~/cli/footer-items.js";
import { useKeyboard, useMutation, usePreferences } from "~/cli/hooks";
import { quit } from "~/cli/quit.js";
import { speak } from "~/cli/services/yappr";
import { semantic } from "~/cli/theme/semantic.js";

export interface SpeakScreenProps {
  onBack: () => void;
}

export function SpeakScreen({ onBack }: SpeakScreenProps) {
  const [value, setValue] = useState("");
  const { preferences } = usePreferences();
  const speakMutation = useMutation<void, Error, string>((text) =>
    speak(text, { voice: preferences.defaultVoice }),
  );

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
      { keys: [...DEFAULT_KEYS.quit], action: quit },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Speak"
        subtitle="Type text and press Enter to synthesize"
      />
      <Box>
        <Text color={semantic.accent}>Text: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Enter text to speak..."
        />
      </Box>
      {speakMutation.isPending && <Loading message="Synthesizing..." />}
      {speakMutation.isSuccess && (
        <Text color={semantic.success}>Done. Playing.</Text>
      )}
      {speakMutation.isError && speakMutation.error && (
        <Text color={semantic.error}>{speakMutation.error.message}</Text>
      )}
      <Footer items={FOOTER_SPEAK} />
    </Box>
  );
}
