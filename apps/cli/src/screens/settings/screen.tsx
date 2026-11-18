import { ScreenShell } from "~/components";
import { FOOTER_SETTINGS_LIST } from "~/footer-items.js";
import { SettingsEditLayer } from "./components/settings-edit-layer.js";
import { SettingsMainList } from "./components/settings-main-list.js";
import { SettingsPickerPanel } from "./components/settings-picker-panel.js";
import { SETTINGS_SUBTITLE } from "./constants.js";
import { useSettingsController } from "./store.js";

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [state, actions] = useSettingsController({ onBack });
  const { picker, textEditorSession } = state;

  if (textEditorSession !== null) {
    return <SettingsEditLayer state={state} actions={actions} />;
  }

  return (
    <ScreenShell
      title="Settings"
      subtitle={SETTINGS_SUBTITLE}
      footerItems={FOOTER_SETTINGS_LIST}
    >
      {!picker ? (
        <SettingsMainList state={state} />
      ) : (
        <SettingsPickerPanel state={state} />
      )}
    </ScreenShell>
  );
}
