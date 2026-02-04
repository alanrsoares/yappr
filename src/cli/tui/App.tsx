import { useState } from "react";

import { Box } from "ink";

import type { ScreenId } from "./constants.js";
import { ChatScreen } from "./screens/ChatScreen.js";
import { ListenScreen } from "./screens/ListenScreen.js";
import { MainMenuScreen } from "./screens/MainMenuScreen.js";
import { McpStatusScreen } from "./screens/McpStatusScreen.js";
import { SpeakScreen } from "./screens/SpeakScreen.js";
import { VoicesScreen } from "./screens/VoicesScreen.js";

export function App() {
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
    </Box>
  );
}
