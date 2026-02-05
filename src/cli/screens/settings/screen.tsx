import { Box, Text } from "ink";

import { Footer, Header } from "~/cli/components";
import { SettingsProvider, useSettingsStore } from "./store.js";

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <SettingsProvider initialState={{ onBack }}>
      <SettingsScreenContent />
    </SettingsProvider>
  );
}

function SettingsScreenContent() {
  const [state] = useSettingsStore();
  const {
    preferences,
    modelsLoading,
    inputDevicesLoading,
    outputDevicesLoading,
    selectedRow,
    picker,
    pickerIndex,
    pickerList,
    inputDeviceLabel,
    outputDeviceLabel,
  } = state;

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Settings" subtitle="~/.yappr/settings.json" />

      {!picker ? (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={selectedRow === 0 ? "cyan" : undefined}>
              {selectedRow === 0 ? "› " : "  "}
            </Text>
            <Text>Ollama model: </Text>
            <Text dimColor={selectedRow !== 0}>
              {modelsLoading ? "…" : preferences.defaultOllamaModel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 1 ? "cyan" : undefined}>
              {selectedRow === 1 ? "› " : "  "}
            </Text>
            <Text>Default voice: </Text>
            <Text dimColor={selectedRow !== 1}>{preferences.defaultVoice}</Text>
          </Box>
          <Box>
            <Text color={selectedRow === 2 ? "cyan" : undefined}>
              {selectedRow === 2 ? "› " : "  "}
            </Text>
            <Text>Input device: </Text>
            <Text dimColor={selectedRow !== 2}>
              {inputDevicesLoading ? "…" : inputDeviceLabel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 3 ? "cyan" : undefined}>
              {selectedRow === 3 ? "› " : "  "}
            </Text>
            <Text>Output device: </Text>
            <Text dimColor={selectedRow !== 3}>
              {outputDevicesLoading ? "…" : outputDeviceLabel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 4 ? "cyan" : undefined}>
              {selectedRow === 4 ? "› " : "  "}
            </Text>
            <Text>Use narration for TTS: </Text>
            <Text dimColor={selectedRow !== 4}>
              {preferences.useNarrationForTTS ? "On" : "Off"}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 5 ? "cyan" : undefined}>
              {selectedRow === 5 ? "› " : "  "}
            </Text>
            <Text>Narration model: </Text>
            <Text dimColor={selectedRow !== 5}>
              {preferences.narrationModel || "(same as chat)"}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to change · b back · q quit</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {picker === "model"
              ? "Choose Ollama model"
              : picker === "voice"
                ? "Choose voice"
                : picker === "input"
                  ? "Choose input device"
                  : picker === "output"
                    ? "Choose output device"
                    : "Choose narration model (for TTS)"}
          </Text>
          {(pickerList ?? []).map((item, i) => (
            <Box key={i}>
              <Text color={i === pickerIndex ? "cyan" : undefined}>
                {i === pickerIndex ? "› " : "  "}
                {typeof item === "string" ? item : item.name}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑/↓ move · Enter confirm · Esc cancel</Text>
          </Box>
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
