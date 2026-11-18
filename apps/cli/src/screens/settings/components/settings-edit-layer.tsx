import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { ScreenShell } from "~/components";
import { FOOTER_SETTINGS_EDIT } from "~/footer-items.js";
import { semantic } from "~/theme/semantic.js";
import { SETTINGS_SUBTITLE } from "../constants.js";
import type {
  SettingsActions,
  SettingsState,
  SettingsTextEditor,
} from "../store.js";

interface TextEditorFieldUi {
  label: string;
  placeholder: string;
}

const TEXT_EDITOR_FIELD_UI: Record<SettingsTextEditor, TextEditorFieldUi> = {
  ollamaUrl: {
    label: "Ollama URL: ",
    placeholder: "http://localhost:11434",
  },
  mcpPath: {
    label: "MCP config path: ",
    placeholder: "~/.config/yappr/mcp.json",
  },
  chatModel: {
    label: "Chat model (OpenRouter): ",
    placeholder: "e.g. openai/gpt-4o",
  },
  openrouterKey: {
    label: "OpenRouter API key: ",
    placeholder: "sk-or-...",
  },
  voiceReferenceAudio: {
    label: "Voice reference · audio path: ",
    placeholder: "/absolute/path/to/reference.wav (leave blank to disable)",
  },
  voiceReferenceTranscript: {
    label: "Voice reference · transcript: ",
    placeholder: "Exact transcript of the reference audio",
  },
};

function EditFieldShell(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  const { label, value, onChange, onSubmit, placeholder } = props;
  return (
    <ScreenShell
      title="Settings"
      subtitle={SETTINGS_SUBTITLE}
      footerItems={FOOTER_SETTINGS_EDIT}
    >
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>{label}</Text>
        <Box
          borderStyle="round"
          borderColor={semantic.border.composer}
          paddingX={1}
          marginTop={1}
        >
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder}
          />
        </Box>
      </Box>
    </ScreenShell>
  );
}

/** Full-screen inline editors. */
export function SettingsEditLayer({
  state,
  actions,
}: {
  state: SettingsState;
  actions: SettingsActions;
}) {
  const session = state.textEditorSession;
  if (!session) return null;

  const ui = TEXT_EDITOR_FIELD_UI[session.field];
  return (
    <EditFieldShell
      label={ui.label}
      value={session.value}
      onChange={actions.setTextEditorValue}
      onSubmit={actions.confirmTextEditor}
      placeholder={ui.placeholder}
    />
  );
}
