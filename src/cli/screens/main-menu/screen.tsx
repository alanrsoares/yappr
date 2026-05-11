import { useState } from "react";
import { Box } from "ink";

import { Footer, Header } from "~/cli/components/index.js";
import { FOOTER_MAIN_MENU } from "~/cli/footer-items.js";
import { MENU_ITEMS } from "~/cli/constants.js";
import { useKeyboard } from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import type { ScreenId } from "~/cli/types.js";
import { Menu } from "./components/menu.js";

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
      { keys: ["q", "escape"], action: quit },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="yappr" subtitle="Voice & tools" />
      <Menu items={MENU_ITEMS} selectedIndex={selectedIndex} />
      <Footer items={FOOTER_MAIN_MENU} marginTop={2} />
    </Box>
  );
}
