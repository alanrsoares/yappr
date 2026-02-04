import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Footer, Header, Loading } from "../components/index.js";
import { useKeyboard } from "../hooks/index.js";
import { listVoices } from "../services/yappr.js";
import { DEFAULT_KEYS } from "../constants.js";

export interface VoicesScreenProps {
  onBack: () => void;
}

export function VoicesScreen({ onBack }: VoicesScreenProps) {
  const [voices, setVoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useKeyboard({
    bindings: [
      { keys: [...DEFAULT_KEYS.back], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Voices" subtitle="TTS voices from server" />
      {loading ? (
        <Loading message="Loading voices..." />
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Box flexDirection="column">
          {voices.map((v) => (
            <Text key={v}>  {v}</Text>
          ))}
        </Box>
      )}
      <Footer items={[{ key: "b", label: "back" }, { key: "q", label: "quit" }]} />
    </Box>
  );
}
