import type { HealthSnapshot } from "@yappr/sdk/health";
import { detectSpeechPreset } from "@yappr/sdk/speech-presets";
import { Box, Text } from "ink";
import { match } from "ts-pattern";

import type { Preferences } from "~/types.js";
import { chatModelRowText } from "../chat-model-row.js";
import {
  CHAT_PROVIDER_LABEL,
  SETTINGS_LIST_ROW,
  type SettingsState,
} from "../store.js";
import { SettingsListRow } from "./settings-list-row.js";

function speechEndpointLabel(
  prefs: Preferences,
  health: HealthSnapshot | undefined,
): string {
  const baseLabel = match(detectSpeechPreset(prefs.voice.speech))
    .with("yappr", () => "Yappr local")
    .with(
      "voxtral",
      () =>
        `Voxtral · ${prefs.voice.speech.kind === "openai-compatible" ? prefs.voice.speech.baseUrl : ""}`,
    )
    .with(
      "custom",
      () =>
        `OpenAI-compatible · ${prefs.voice.speech.kind === "openai-compatible" ? prefs.voice.speech.baseUrl : ""}`,
    )
    .exhaustive();
  if (!health || prefs.voice.speech.kind !== "yappr") return baseLabel;
  return `${baseLabel} (tts=${health.ttsBackend ?? "—"} · stt=${health.sttBackend ?? "—"})`;
}

/** Main settings rows when no picker is open. */
export function SettingsMainList({ state }: { state: SettingsState }) {
  const {
    preferences,
    engineHealth,
    modelsLoading,
    openRouterModelsLoading,
    inputDevicesLoading,
    outputDevicesLoading,
    inputDeviceLabel,
    outputDeviceLabel,
    selectedRow,
  } = state;

  const R = SETTINGS_LIST_ROW;

  // Voice cloning is a per-adapter capability advertised in /health. When the
  // active backend doesn't support it, the reference rows still render (the
  // menu nav is fixed-index) but say so instead of inviting unused input.
  const cloningSupported = engineHealth?.ttsFeatures?.cloning ?? false;
  const cloningUnsupportedHint = `(unsupported by ${engineHealth?.ttsBackend ?? "active backend"})`;

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
        index={R.speechEndpoint}
        selectedRow={selectedRow}
        label="Speech endpoint: "
        value={speechEndpointLabel(preferences, engineHealth)}
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
        index={R.voiceReferenceAudio}
        selectedRow={selectedRow}
        label="Voice ref · audio path: "
        value={
          preferences.voiceReference?.audio_path ||
          (cloningSupported ? "(none)" : cloningUnsupportedHint)
        }
      />
      <SettingsListRow
        index={R.voiceReferenceTranscript}
        selectedRow={selectedRow}
        label="Voice ref · transcript: "
        value={
          preferences.voiceReference?.transcript
            ? preferences.voiceReference.transcript.length > 40
              ? `${preferences.voiceReference.transcript.slice(0, 40)}…`
              : preferences.voiceReference.transcript
            : cloningSupported
              ? "(none)"
              : cloningUnsupportedHint
        }
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
