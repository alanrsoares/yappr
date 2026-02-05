import { Box, Text } from "ink";
import TextInput from "ink-text-input";

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
  const [state, actions] = useSettingsStore();
  const {
    preferences,
    modelsLoading,
    openRouterModelsLoading,
    inputDevicesLoading,
    outputDevicesLoading,
    selectedRow,
    picker,
    effectivePickerIndex,
    pickerFilterText,
    visiblePickerSlice,
    visiblePickerStart,
    pickerLen,
    visiblePickerRows,
    inputDeviceLabel,
    outputDeviceLabel,
    editingOllamaUrl,
    ollamaUrlInputValue,
    editingMcpConfigPath,
    mcpConfigPathInputValue,
    editingChatModel,
    chatModelInputValue,
    editingOpenrouterApiKey,
    openrouterApiKeyInputValue,
  } = state;
  const {
    setOllamaUrlInputValue,
    confirmOllamaUrlEdit,
    setMcpConfigPathInputValue,
    confirmMcpConfigPathEdit,
    setChatModelInputValue,
    confirmChatModelEdit,
    setOpenrouterApiKeyInputValue,
    confirmOpenrouterApiKeyEdit,
  } = actions;

  if (editingChatModel) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Settings" subtitle="~/.yappr/settings.json" />
        <Box flexDirection="column" marginTop={1}>
          <Text>Chat model (OpenRouter): </Text>
          <TextInput
            value={chatModelInputValue}
            onChange={setChatModelInputValue}
            onSubmit={confirmChatModelEdit}
            placeholder="e.g. openai/gpt-4o"
          />
          <Box marginTop={1}>
            <Text dimColor>Enter save · Esc cancel</Text>
          </Box>
        </Box>
        <Footer
          items={[
            { key: "Esc", label: "cancel" },
            { key: "Esc", label: "back" },
            { key: "q", label: "quit" },
          ]}
        />
      </Box>
    );
  }

  if (editingOpenrouterApiKey) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Settings" subtitle="~/.yappr/settings.json" />
        <Box flexDirection="column" marginTop={1}>
          <Text>OpenRouter API key: </Text>
          <TextInput
            value={openrouterApiKeyInputValue}
            onChange={setOpenrouterApiKeyInputValue}
            onSubmit={confirmOpenrouterApiKeyEdit}
            placeholder="sk-or-..."
          />
          <Box marginTop={1}>
            <Text dimColor>Enter save · Esc cancel</Text>
          </Box>
        </Box>
        <Footer
          items={[
            { key: "Esc", label: "cancel" },
            { key: "Esc", label: "back" },
            { key: "q", label: "quit" },
          ]}
        />
      </Box>
    );
  }

  if (editingMcpConfigPath) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Settings" subtitle="~/.yappr/settings.json" />
        <Box flexDirection="column" marginTop={1}>
          <Text>MCP config path: </Text>
          <TextInput
            value={mcpConfigPathInputValue}
            onChange={setMcpConfigPathInputValue}
            onSubmit={confirmMcpConfigPathEdit}
            placeholder="~/.cursor/mcp.json"
          />
          <Box marginTop={1}>
            <Text dimColor>Enter save · Esc cancel</Text>
          </Box>
        </Box>
        <Footer
          items={[
            { key: "Esc", label: "cancel" },
            { key: "Esc", label: "back" },
            { key: "q", label: "quit" },
          ]}
        />
      </Box>
    );
  }

  if (editingOllamaUrl) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Settings" subtitle="~/.yappr/settings.json" />
        <Box flexDirection="column" marginTop={1}>
          <Text>Ollama URL: </Text>
          <TextInput
            value={ollamaUrlInputValue}
            onChange={setOllamaUrlInputValue}
            onSubmit={confirmOllamaUrlEdit}
            placeholder="http://localhost:11434"
          />
          <Box marginTop={1}>
            <Text dimColor>Enter save · Esc cancel</Text>
          </Box>
        </Box>
        <Footer
          items={[
            { key: "Esc", label: "cancel" },
            { key: "Esc", label: "back" },
            { key: "q", label: "quit" },
          ]}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Settings" subtitle="~/.yappr/settings.json" />

      {!picker ? (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={selectedRow === 0 ? "cyan" : undefined}>
              {selectedRow === 0 ? "› " : "  "}
            </Text>
            <Text>Chat provider: </Text>
            <Text dimColor={selectedRow !== 0}>
              {preferences.defaultChatProvider === "openrouter"
                ? "OpenRouter"
                : "Ollama"}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 1 ? "cyan" : undefined}>
              {selectedRow === 1 ? "› " : "  "}
            </Text>
            <Text>Chat model: </Text>
            <Text dimColor={selectedRow !== 1}>
              {preferences.defaultChatProvider === "openrouter"
                ? openRouterModelsLoading
                  ? "…"
                  : preferences.defaultChatModel ||
                    "(set API key, then pick model)"
                : modelsLoading
                  ? "…"
                  : preferences.defaultChatModel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 2 ? "cyan" : undefined}>
              {selectedRow === 2 ? "› " : "  "}
            </Text>
            <Text>Default voice: </Text>
            <Text dimColor={selectedRow !== 2}>{preferences.defaultVoice}</Text>
          </Box>
          <Box>
            <Text color={selectedRow === 3 ? "cyan" : undefined}>
              {selectedRow === 3 ? "› " : "  "}
            </Text>
            <Text>Input device: </Text>
            <Text dimColor={selectedRow !== 3}>
              {inputDevicesLoading ? "…" : inputDeviceLabel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 4 ? "cyan" : undefined}>
              {selectedRow === 4 ? "› " : "  "}
            </Text>
            <Text>Output device: </Text>
            <Text dimColor={selectedRow !== 4}>
              {outputDevicesLoading ? "…" : outputDeviceLabel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 5 ? "cyan" : undefined}>
              {selectedRow === 5 ? "› " : "  "}
            </Text>
            <Text>Use narration for TTS: </Text>
            <Text dimColor={selectedRow !== 5}>
              {preferences.useNarrationForTTS ? "On" : "Off"}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 6 ? "cyan" : undefined}>
              {selectedRow === 6 ? "› " : "  "}
            </Text>
            <Text>Narration model: </Text>
            <Text dimColor={selectedRow !== 6}>
              {preferences.narrationModel || "(same as chat)"}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 7 ? "cyan" : undefined}>
              {selectedRow === 7 ? "› " : "  "}
            </Text>
            <Text>Ollama URL: </Text>
            <Text dimColor={selectedRow !== 7}>
              {preferences.ollamaBaseUrl}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 8 ? "cyan" : undefined}>
              {selectedRow === 8 ? "› " : "  "}
            </Text>
            <Text>OpenRouter API key: </Text>
            <Text dimColor={selectedRow !== 8}>
              {preferences.openrouterApiKey
                ? `${preferences.openrouterApiKey.slice(0, 8)}…`
                : "(not set)"}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 9 ? "cyan" : undefined}>
              {selectedRow === 9 ? "› " : "  "}
            </Text>
            <Text>MCP config path: </Text>
            <Text dimColor={selectedRow !== 9}>
              {preferences.mcpConfigPath}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to change · Esc back · q quit</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {picker === "provider"
              ? "Choose chat provider"
              : picker === "model"
                ? "Choose Ollama model"
                : picker === "openRouterModel"
                  ? "Choose OpenRouter model (text + tools)"
                  : picker === "voice"
                    ? "Choose voice"
                    : picker === "input"
                      ? "Choose input device"
                      : picker === "output"
                        ? "Choose output device"
                        : "Choose narration model (for TTS)"}
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Filter: </Text>
            <Text>{pickerFilterText || "(type to filter)"}</Text>
          </Box>
          {visiblePickerSlice.map((item, i) => {
            const actualIndex = visiblePickerStart + i;
            const label =
              typeof item === "string" ? item : (item as { name: string }).name;
            return (
              <Box key={actualIndex}>
                <Text
                  color={
                    actualIndex === effectivePickerIndex ? "cyan" : undefined
                  }
                >
                  {actualIndex === effectivePickerIndex ? "› " : "  "}
                  {label}
                </Text>
              </Box>
            );
          })}
          <Box marginTop={1}>
            <Text dimColor>
              {pickerLen > visiblePickerRows
                ? `${visiblePickerStart + 1}-${Math.min(visiblePickerStart + visiblePickerSlice.length, pickerLen)} of ${pickerLen} · `
                : ""}
              ↑/↓ scroll · Type to filter · Enter confirm · Esc cancel
            </Text>
          </Box>
        </Box>
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
