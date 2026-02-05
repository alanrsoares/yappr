import { useState } from "react";
import { Box } from "ink";

import type { ScreenId } from "./types.js";
import { ChatScreen } from "./screens/chat/index.js";
import { ListenScreen } from "./screens/listen/index.js";
import { MainMenuScreen } from "./screens/main-menu/index.js";
import { McpStatusScreen } from "./screens/mcp-status/index.js";
import { SettingsScreen } from "./screens/settings/index.js";
import { SpeakScreen } from "./screens/speak/index.js";
import { VoicesScreen } from "./screens/voices/index.js";

export function Root() {
  const [screen, setScreen] = useState<ScreenId>("menu");

  const goBack = () => setScreen("menu");

  return (
    <Box flexDirection="column">
      {screen === "menu" && <MainMenuScreen onSelect={(id) => setScreen(id)} />}
      {screen === "mcp" && <McpStatusScreen onBack={goBack} />}
      {screen === "speak" && <SpeakScreen onBack={goBack} />}
      {screen === "chat" && <ChatScreen onBack={goBack} />}
      {screen === "listen" && <ListenScreen onBack={goBack} />}
      {screen === "voices" && <VoicesScreen onBack={goBack} />}
      {screen === "settings" && <SettingsScreen onBack={goBack} />}
    </Box>
  );
}
