import type { FooterItem } from "~/cli/components/index.js";

/** Matches chat slash footer (`↑↓` + Footer arrow pulse). */
export const FOOTER_MAIN_MENU: FooterItem[] = [
  { key: "↑↓", label: "select" },
  { key: "Enter", label: "open" },
  { key: "q", label: "quit" },
];

export const footerQuit = () => ({ key: "q", label: "quit" });

export const footerEscBack = () => ({ key: "Esc", label: "back" });

export const footerEscCancel = () => ({ key: "Esc", label: "cancel" });

export const footerRefresh = () => ({ key: "r", label: "refresh" });

/** MCP status screen */
export const FOOTER_MCP_STATUS: FooterItem[] = [
  footerRefresh(),
  footerEscBack(),
  footerQuit(),
];

/** Speak screen */
export const FOOTER_SPEAK: FooterItem[] = [footerEscBack(), footerQuit()];

/** Settings main list + picker (same keys as MCP / Speak for quit). */
export const FOOTER_SETTINGS_LIST: FooterItem[] = [
  footerEscBack(),
  footerQuit(),
];

/**
 * Inline text editors: `q` would go into the field — use Ctrl+q to quit here.
 */
export const FOOTER_SETTINGS_EDIT: FooterItem[] = [
  footerEscCancel(),
  { key: "Ctrl+s", label: "save" },
  { key: "Ctrl+q", label: "quit" },
];

export const footerVoices = (escLabel: string): FooterItem[] => [
  { key: "Esc", label: escLabel },
  { key: "Ctrl+p", label: "sample" },
  { key: "Ctrl+e", label: "phrase" },
  { key: "Enter", label: "play" },
  footerQuit(),
];

type ComposerTailMode = "slash" | "submit" | "commands";

const CHAT_COMPOSER_TAIL: Record<ComposerTailMode, readonly FooterItem[]> = {
  slash: [
    { key: "↑↓", label: "select" },
    { key: "Enter", label: "run" },
  ],
  submit: [{ key: "Enter", label: "submit" }],
  commands: [{ key: "/", label: "commands" }],
};

const FOOTER_CTRL_C_STOP: FooterItem = { key: "ctrl+c", label: "stop" };

export function buildChatFooterItems(opts: {
  isSlashPalette: boolean;
  isChatPending: boolean;
  hasComposerValue: boolean;
}) {
  const { isSlashPalette, isChatPending, hasComposerValue } = opts;
  const tailMode: ComposerTailMode = isSlashPalette
    ? "slash"
    : hasComposerValue
      ? "submit"
      : "commands";

  const base: FooterItem[] = [
    { key: "ctrl+t", label: "voice" },
    {
      key: "Esc",
      label: isSlashPalette ? "cancel /" : "back",
    },
    { key: "/quit", label: "exit app" },
  ];

  return [
    ...base,
    ...(isChatPending ? [FOOTER_CTRL_C_STOP] : []),
    ...CHAT_COMPOSER_TAIL[tailMode],
  ];
}
