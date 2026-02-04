import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, useQuery } from "~/cli/hooks";
import { listVoices } from "~/cli/services/yappr.js";

export interface VoicesScreenProps {
  onBack: () => void;
}

export function VoicesScreen({ onBack }: VoicesScreenProps) {
  const { data: voices = [], error, isLoading } = useQuery(listVoices);

  useKeyboard({
    bindings: [
      { keys: [...DEFAULT_KEYS.back], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Voices" subtitle="TTS voices from server" />
      {isLoading ? (
        <Loading message="Loading voices..." />
      ) : error ? (
        <Text color="red">{error.message}</Text>
      ) : (
        <Box flexDirection="column">
          {voices.map((v) => (
            <Text key={v}> {v}</Text>
          ))}
        </Box>
      )}
      <Footer
        items={[
          { key: "b", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
