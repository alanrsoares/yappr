import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState } from "react";

import { Loading, ScreenShell } from "~/components";
import { FOOTER_SPEAK } from "~/footer-items.js";
import { useKeyboard, useMutation, usePreferences } from "~/hooks";
import { quit } from "~/quit.js";
import { speak } from "~/services/yappr";
import { semantic } from "~/theme/semantic.js";

export interface SpeakScreenProps {
  onBack: () => void;
}

export function SpeakScreen({ onBack }: SpeakScreenProps) {
  const [value, setValue] = useState("");
  const { preferences } = usePreferences();
  const speakMutation = useMutation<void, Error, string>((text) =>
    speak(text, {
      voice: preferences.defaultVoice,
      ...(preferences.voiceReference
        ? { reference: preferences.voiceReference }
        : {}),
    }),
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
      { keys: ["ctrl+q"], action: quit },
    ],
  });

  return (
    <ScreenShell
      title="Speak"
      subtitle={`Voice: ${preferences.defaultVoice}`}
      footerItems={FOOTER_SPEAK}
    >
      <Box
        borderStyle="round"
        borderColor={semantic.border.composer}
        paddingX={1}
        flexDirection="row"
        alignItems="center"
      >
        <Box marginRight={1}>
          <Text color={semantic.accent} bold>
            ›
          </Text>
        </Box>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Type text to speak and press Enter…"
        />
      </Box>
      <Box marginTop={1}>
        {speakMutation.isPending && <Loading message="Synthesizing…" />}
        {speakMutation.isSuccess && (
          <Text color={semantic.success}>✓ Playing.</Text>
        )}
        {speakMutation.isError && speakMutation.error && (
          <Text color={semantic.error}>✗ {speakMutation.error.message}</Text>
        )}
      </Box>
    </ScreenShell>
  );
}
