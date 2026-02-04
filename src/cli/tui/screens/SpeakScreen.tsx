import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header, Loading } from "../components/index.js";
import { DEFAULT_KEYS } from "../constants.js";
import { useKeyboard } from "../hooks/index.js";
import { speak } from "../services/yappr.js";

export interface SpeakScreenProps {
  onBack: () => void;
}

export function SpeakScreen({ onBack }: SpeakScreenProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      await speak(text.trim());
      setStatus("done");
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

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
      {status === "loading" && <Loading message="Synthesizing..." />}
      {status === "done" && <Text color="green">Done. Playing.</Text>}
      {status === "error" && error && <Text color="red">{error}</Text>}
      <Footer
        items={[
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
