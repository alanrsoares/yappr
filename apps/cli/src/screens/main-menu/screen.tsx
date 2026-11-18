import { useMemo, useState } from "react";
import { ScreenShell } from "~/components/index.js";
import { MENU_ITEMS } from "~/constants.js";
import { FOOTER_MAIN_MENU } from "~/footer-items.js";
import { useKeyboard, usePreferences } from "~/hooks/index.js";
import { quit } from "~/quit.js";
import type { ScreenId } from "~/types.js";
import pkg from "../../../package.json" with { type: "json" };
import { Menu } from "./components/menu.js";

export interface MainMenuScreenProps {
  onSelect: (screen: ScreenId) => void;
}

export function MainMenuScreen({ onSelect }: MainMenuScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { preferences } = usePreferences();

  const items = useMemo(
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
      ...items.map((item, idx) => ({
        keys: [String(idx + 1)],
        action: () => onSelect(item.id),
      })),
      { keys: ["q", "escape"], action: quit },
    ],
  });

  const subtitle = `${preferences.defaultChatModel} · ${preferences.defaultChatProvider} · voice: ${preferences.defaultVoice}`;

  return (
    <ScreenShell
      title="yappr"
      badge={`v${pkg.version}`}
      subtitle={subtitle}
      footerItems={FOOTER_MAIN_MENU}
    >
      <Menu items={items} selectedIndex={selectedIndex} />
    </ScreenShell>
  );
}
