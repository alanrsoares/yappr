import { Box, Text } from "ink";

import { chatModelRowText } from "../chat-model-row.js";
import { CHAT_PROVIDER_LABEL, useSettingsStore } from "../store.js";
import { SettingsListRow } from "./settings-list-row.js";

/** Main settings rows when no picker is open. */
export function SettingsMainList() {
  const [
    {
      preferences,
      modelsLoading,
      openRouterModelsLoading,
      inputDevicesLoading,
      outputDevicesLoading,
      inputDeviceLabel,
      outputDeviceLabel,
      selectedRow,
    },
  ] = useSettingsStore();

  return (
    <Box flexDirection="column" marginTop={1}>
      <SettingsListRow
        index={0}
        selectedRow={selectedRow}
        label="Chat provider: "
        value={CHAT_PROVIDER_LABEL[preferences.defaultChatProvider]}
      />
      <SettingsListRow
        index={1}
        selectedRow={selectedRow}
        label="Chat model: "
        value={chatModelRowText({
          defaultChatProvider: preferences.defaultChatProvider,
          openRouterModelsLoading,
          modelsLoading,
          defaultChatModel: preferences.defaultChatModel,
        })}
      />
      <SettingsListRow
        index={2}
        selectedRow={selectedRow}
        label="Default voice: "
        value={preferences.defaultVoice}
      />
      <SettingsListRow
        index={3}
        selectedRow={selectedRow}
        label="Input device: "
        value={inputDevicesLoading ? "…" : inputDeviceLabel}
      />
      <SettingsListRow
        index={4}
        selectedRow={selectedRow}
        label="Output device: "
        value={outputDevicesLoading ? "…" : outputDeviceLabel}
      />
      <SettingsListRow
        index={5}
        selectedRow={selectedRow}
        label="Use narration for TTS: "
        value={preferences.useNarrationForTTS ? "On" : "Off"}
      />
      <SettingsListRow
        index={6}
        selectedRow={selectedRow}
        label="Narration model: "
        value={preferences.narrationModel || "(same as chat)"}
      />
      <SettingsListRow
        index={7}
        selectedRow={selectedRow}
        label="Ollama URL: "
        value={preferences.ollamaBaseUrl}
      />
      <SettingsListRow
        index={8}
        selectedRow={selectedRow}
        label="OpenRouter API key: "
        value={
          preferences.openrouterApiKey
            ? `${preferences.openrouterApiKey.slice(0, 8)}…`
            : "(not set)"
        }
      />
      <SettingsListRow
        index={9}
        selectedRow={selectedRow}
        label="MCP config path: "
        value={preferences.mcpConfigPath}
      />
      <Box marginTop={1}>
        <Text dimColor>Enter to change · Esc back · q quit</Text>
      </Box>
    </Box>
  );
}
