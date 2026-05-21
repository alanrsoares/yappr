import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header } from "~/components";
import { FOOTER_SETTINGS_EDIT } from "~/footer-items.js";
import { SETTINGS_SUBTITLE } from "../constants.js";
import { useSettingsStore, type SettingsTextEditor } from "../store.js";

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
    label: "Voice reference · audio path (Dia): ",
    placeholder: "/absolute/path/to/reference.wav (leave blank to disable)",
  },
  voiceReferenceTranscript: {
    label: "Voice reference · transcript (Dia): ",
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
    <Box flexDirection="column" padding={1}>
      <Header title="Settings" subtitle={SETTINGS_SUBTITLE} />
      <Box flexDirection="column" marginTop={1}>
        <Text>{label}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
        />
        <Box marginTop={1}>
          <Text dimColor>Enter or Ctrl+s save · Esc cancel · Ctrl+q quit</Text>
        </Box>
      </Box>
      <Footer items={FOOTER_SETTINGS_EDIT} />
    </Box>
  );
}

/** Full-screen inline editors (must render under `SettingsProvider`). */
export function SettingsEditLayer() {
  const [state, actions] = useSettingsStore();
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
