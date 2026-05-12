import { Box, Text } from "ink";

import { chatModelRowText } from "../chat-model-row.js";
import {
  CHAT_PROVIDER_LABEL,
  SETTINGS_LIST_ROW,
  useSettingsStore,
} from "../store.js";
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

  const R = SETTINGS_LIST_ROW;

  return (
    <Box flexDirection="column" marginTop={1}>
      <SettingsListRow
        index={R.chatProvider}
        selectedRow={selectedRow}
        label="Chat provider: "
        value={CHAT_PROVIDER_LABEL[preferences.defaultChatProvider]}
      />
      <SettingsListRow
        index={R.chatModel}
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
        index={R.defaultVoice}
        selectedRow={selectedRow}
        label="Default voice: "
        value={preferences.defaultVoice}
      />
      <SettingsListRow
        index={R.inputDevice}
        selectedRow={selectedRow}
        label="Input device: "
        value={inputDevicesLoading ? "…" : inputDeviceLabel}
      />
      <SettingsListRow
        index={R.outputDevice}
        selectedRow={selectedRow}
        label="Output device: "
        value={outputDevicesLoading ? "…" : outputDeviceLabel}
      />
      <SettingsListRow
        index={R.useNarrationForTts}
        selectedRow={selectedRow}
        label="Use narration for TTS: "
        value={preferences.useNarrationForTTS ? "On" : "Off"}
      />
      <SettingsListRow
        index={R.narrationModel}
        selectedRow={selectedRow}
        label="Narration model: "
        value={preferences.narrationModel || "(same as chat)"}
      />
      <SettingsListRow
        index={R.ollamaUrl}
        selectedRow={selectedRow}
        label="Ollama URL: "
        value={preferences.ollamaBaseUrl}
      />
      <SettingsListRow
        index={R.openrouterApiKey}
        selectedRow={selectedRow}
        label="OpenRouter API key: "
        value={
          preferences.openrouterApiKey
            ? `${preferences.openrouterApiKey.slice(0, 8)}…`
            : "(not set)"
        }
      />
      <SettingsListRow
        index={R.mcpConfigPath}
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
