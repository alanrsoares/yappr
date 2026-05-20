import { useCallback, useState } from "react";
import { Box } from "ink";

import pkg from "../package.json" with { type: "json" };
import { Splash } from "./components/index.js";
import { useTerminalHeight, useTerminalWidth } from "./hooks/index.js";
import { usePreferences } from "./hooks/usePreferences.js";
import { ChatScreen } from "./screens/chat/index.js";
import { MainMenuScreen } from "./screens/main-menu/index.js";
import { McpStatusScreen } from "./screens/mcp-status/index.js";
import { SettingsScreen } from "./screens/settings/index.js";
import { SetupScreen } from "./screens/setup/index.js";
import { SpeakScreen } from "./screens/speak/index.js";
import { VoicesScreen } from "./screens/voices/index.js";
import type { ScreenId } from "./types.js";

export function Root() {
  const [screen, setScreen] = useState<ScreenId>("menu");
  const [showSplash, setShowSplash] = useState(true);
  // Session-local: true once the wizard has been exited (completed or skipped).
  // Prevents re-entering setup while the async pref write is still in flight.
  const [setupAcknowledged, setSetupAcknowledged] = useState(false);
  const terminalWidth = useTerminalWidth();
  const terminalHeight = useTerminalHeight();
  const { preferences, isLoading: prefsLoading } = usePreferences();

  // First-run gate: redirect "menu" → "setup" until the wizard is completed
  // OR acknowledged in this session. Derived (not stored) so it stays in sync
  // without setState-in-effect.
  const effectiveScreen: ScreenId =
    !prefsLoading &&
    !preferences.firstRunCompleted &&
    !setupAcknowledged &&
    screen === "menu"
      ? "setup"
      : screen;

  const goBack = useCallback(() => {
    setScreen("menu");
  }, []);

  const onSetupDone = useCallback(() => {
    setSetupAcknowledged(true);
    setScreen("menu");
  }, []);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return (
      <Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
        <Splash version={pkg.version} onDismiss={dismissSplash} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
      {effectiveScreen === "menu" && (
        <MainMenuScreen onSelect={(id) => setScreen(id)} />
      )}
      {effectiveScreen === "mcp" && <McpStatusScreen onBack={goBack} />}
      {effectiveScreen === "speak" && <SpeakScreen onBack={goBack} />}
      {effectiveScreen === "chat" && (
        <ChatScreen onBack={goBack} onNavigate={setScreen} />
      )}
      {effectiveScreen === "voices" && <VoicesScreen onBack={goBack} />}
      {effectiveScreen === "settings" && <SettingsScreen onBack={goBack} />}
      {effectiveScreen === "setup" && <SetupScreen onDone={onSetupDone} />}
    </Box>
  );
}
