import { useState } from "react";

import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header, Loading } from "../components/index.js";
import { DEFAULT_KEYS } from "../constants.js";
import { useKeyboard } from "../hooks/index.js";
import { chat, speak } from "../services/yappr.js";

export interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (prompt: string) => {
    if (!prompt.trim()) return;
    setStatus("loading");
    setError(null);
    setResponse(null);
    try {
      const text = await chat(prompt.trim());
      setResponse(text ?? "(no response)");
      setStatus("done");
      setValue("");
      if (text) await speak(text);
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
      {status === "loading" && <Loading message="Waiting for Ollama..." />}
      {status === "done" && response && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Ollama:</Text>
          <Text>{response}</Text>
        </Box>
      )}
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
