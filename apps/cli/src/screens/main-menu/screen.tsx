import { useMemo, useState } from "react";
import { Box } from "ink";

import { Footer, Header } from "~/components/index.js";
import { MENU_ITEMS } from "~/constants.js";
import { FOOTER_MAIN_MENU } from "~/footer-items.js";
import { useKeyboard, usePreferences } from "~/hooks/index.js";
import { quit } from "~/quit.js";
import type { ScreenId } from "~/types.js";
import { Menu } from "./components/menu.js";

export interface MainMenuScreenProps {
  onSelect: (screen: ScreenId) => void;
}

export function MainMenuScreen({ onSelect }: MainMenuScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { preferences } = usePreferences();

  const items: typeof MENU_ITEMS = useMemo(
    () =>
      MENU_ITEMS.map((item) =>
        item.id === "setup"
          ? { ...item, done: preferences.firstRunCompleted }
          : item,
      ),
    [preferences.firstRunCompleted],
  );

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () =>
          setSelectedIndex((i) => (i > 0 ? i - 1 : items.length - 1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () =>
          setSelectedIndex((i) => (i < items.length - 1 ? i + 1 : 0)),
      },
      {
        keys: ["return", "enter"],
        action: () => onSelect(items[selectedIndex]!.id),
      },
      { keys: ["q", "escape"], action: quit },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="yappr" subtitle="Voice & tools" />
      <Menu items={items} selectedIndex={selectedIndex} />
      <Footer items={FOOTER_MAIN_MENU} marginTop={2} />
    </Box>
  );
}
