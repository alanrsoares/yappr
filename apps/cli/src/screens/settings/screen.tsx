import { Box } from "ink";

import { Footer, Header } from "~/components";
import { FOOTER_SETTINGS_LIST } from "~/footer-items.js";
import { SettingsEditLayer } from "./components/settings-edit-layer.js";
import { SettingsMainList } from "./components/settings-main-list.js";
import { SettingsPickerPanel } from "./components/settings-picker-panel.js";
import { SETTINGS_SUBTITLE } from "./constants.js";
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
  const { picker, textEditorSession } = state;

  const isInlineEditing = textEditorSession !== null;

  if (isInlineEditing) {
    return <SettingsEditLayer />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Settings" subtitle={SETTINGS_SUBTITLE} />

      {!picker ? <SettingsMainList /> : <SettingsPickerPanel />}

      <Footer items={FOOTER_SETTINGS_LIST} />
    </Box>
  );
}
