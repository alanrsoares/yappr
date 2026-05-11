import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { Footer, Header } from "~/cli/components";
import { FOOTER_SETTINGS_EDIT } from "~/cli/footer-items.js";
import { SETTINGS_SUBTITLE } from "../constants.js";
import { useSettingsStore } from "../store.js";

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

  if (state.editingChatModel) {
    return (
      <EditFieldShell
        label="Chat model (OpenRouter): "
        value={state.chatModelInputValue}
        onChange={actions.setChatModelInputValue}
        onSubmit={actions.confirmChatModelEdit}
        placeholder="e.g. openai/gpt-4o"
      />
    );
  }

  if (state.editingOpenrouterApiKey) {
    return (
      <EditFieldShell
        label="OpenRouter API key: "
        value={state.openrouterApiKeyInputValue}
        onChange={actions.setOpenrouterApiKeyInputValue}
        onSubmit={actions.confirmOpenrouterApiKeyEdit}
        placeholder="sk-or-..."
      />
    );
  }

  if (state.editingMcpConfigPath) {
    return (
      <EditFieldShell
        label="MCP config path: "
        value={state.mcpConfigPathInputValue}
        onChange={actions.setMcpConfigPathInputValue}
        onSubmit={actions.confirmMcpConfigPathEdit}
        placeholder="~/.cursor/mcp.json"
      />
    );
  }

  if (state.editingOllamaUrl) {
    return (
      <EditFieldShell
        label="Ollama URL: "
        value={state.ollamaUrlInputValue}
        onChange={actions.setOllamaUrlInputValue}
        onSubmit={actions.confirmOllamaUrlEdit}
        placeholder="http://localhost:11434"
      />
    );
  }

  return null;
}
