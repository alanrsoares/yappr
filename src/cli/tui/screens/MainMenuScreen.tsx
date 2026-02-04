import React, { useState } from "react";
import { Box, Text } from "ink";

import { Header, Menu } from "../components/index.js";
import { MENU_ITEMS, type ScreenId } from "../constants.js";
import { useKeyboard } from "../hooks/index.js";

export interface MainMenuScreenProps {
  onSelect: (screen: ScreenId) => void;
}

export function MainMenuScreen({ onSelect }: MainMenuScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () =>
          setSelectedIndex((i) => (i > 0 ? i - 1 : MENU_ITEMS.length - 1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () =>
          setSelectedIndex((i) => (i < MENU_ITEMS.length - 1 ? i + 1 : 0)),
      },
      {
        keys: ["return", "enter"],
        action: () => onSelect(MENU_ITEMS[selectedIndex]!.id),
      },
      { keys: ["q", "escape"], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="yappr" subtitle="Voice & tools" />
      <Menu items={MENU_ITEMS} selectedIndex={selectedIndex} />
      <Box marginTop={2}>
        <Text dimColor>↑/↓ select · Enter open · q quit</Text>
      </Box>
    </Box>
  );
}
