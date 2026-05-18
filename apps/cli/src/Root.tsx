import { useCallback, useState } from "react";
import { Box } from "ink";

import pkg from "../package.json" with { type: "json" };
import { Splash } from "./components/index.js";
import { useTerminalHeight, useTerminalWidth } from "./hooks/index.js";
import { ChatScreen } from "./screens/chat/index.js";
import { MainMenuScreen } from "./screens/main-menu/index.js";
import { McpStatusScreen } from "./screens/mcp-status/index.js";
import { SettingsScreen } from "./screens/settings/index.js";
import { SpeakScreen } from "./screens/speak/index.js";
import { VoicesScreen } from "./screens/voices/index.js";
import type { ScreenId } from "./types.js";

export function Root() {
  const [screen, setScreen] = useState<ScreenId>("menu");
  const [showSplash, setShowSplash] = useState(true);
  const terminalWidth = useTerminalWidth();
  const terminalHeight = useTerminalHeight();

  const goBack = useCallback(() => {
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
      {screen === "menu" && <MainMenuScreen onSelect={(id) => setScreen(id)} />}
      {screen === "mcp" && <McpStatusScreen onBack={goBack} />}
      {screen === "speak" && <SpeakScreen onBack={goBack} />}
      {screen === "chat" && (
        <ChatScreen onBack={goBack} onNavigate={setScreen} />
      )}
      {screen === "voices" && <VoicesScreen onBack={goBack} />}
      {screen === "settings" && <SettingsScreen onBack={goBack} />}
    </Box>
  );
}
