import type { FooterItem } from "~/components/index.js";

export const FOOTER_MAIN_MENU: FooterItem[] = [
  { key: "↑↓", label: "select" },
  { key: "1-6", label: "jump" },
  { key: "Enter", label: "open" },
  { key: "q", label: "quit" },
];

export const footerQuit = () => ({ key: "q", label: "quit" });

export const footerCtrlQuit = () => ({ key: "Ctrl+Q", label: "quit" });

export const footerEscBack = () => ({ key: "Esc", label: "back" });

export const footerEscCancel = () => ({ key: "Esc", label: "cancel" });

export const footerRefresh = () => ({ key: "r", label: "refresh" });

/** MCP status screen */
export const FOOTER_MCP_STATUS: FooterItem[] = [
  footerRefresh(),
  footerEscBack(),
  footerQuit(),
];

/** Speak screen (text input active: use Ctrl+Q to quit) */
export const FOOTER_SPEAK: FooterItem[] = [
  { key: "Enter", label: "speak" },
  footerEscBack(),
  footerCtrlQuit(),
];

/** Settings main list + picker */
export const FOOTER_SETTINGS_LIST: FooterItem[] = [
  { key: "↑↓", label: "select" },
  { key: "Enter", label: "edit" },
  footerEscBack(),
  footerQuit(),
];

/**
 * Inline text editors: `q` would go into the field — use Ctrl+Q to quit here.
 */
export const FOOTER_SETTINGS_EDIT: FooterItem[] = [
  { key: "Enter", label: "save" },
  { key: "Ctrl+S", label: "save" },
  footerEscCancel(),
  footerCtrlQuit(),
];

export const footerVoices = (escLabel: string): FooterItem[] => [
  { key: "↑↓", label: "select" },
  { key: "Enter", label: "play" },
  { key: "Ctrl+P", label: "sample" },
  { key: "Ctrl+E", label: "phrase" },
  { key: "Esc", label: escLabel },
  footerQuit(),
];

export const FOOTER_SETUP: FooterItem[] = [
  { key: "Enter", label: "next" },
  { key: "Esc", label: "skip setup" },
  footerCtrlQuit(),
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

const FOOTER_CTRL_C_STOP: FooterItem = { key: "Ctrl+C", label: "stop" };

export function buildChatFooterItems(opts: {
  isSlashPalette: boolean;
  isChatPending: boolean;
  hasComposerValue: boolean;
  isEventStreamOpen?: boolean;
}) {
  const {
    isSlashPalette,
    isChatPending,
    hasComposerValue,
    isEventStreamOpen = false,
  } = opts;
  if (isEventStreamOpen) {
    return [
      { key: "↑↓", label: "select" },
      { key: "Enter", label: "details" },
      { key: "f", label: "filter" },
      footerEscBack(),
    ];
  }

  const tailMode: ComposerTailMode = isSlashPalette
    ? "slash"
    : hasComposerValue
      ? "submit"
      : "commands";

  const base: FooterItem[] = [
    { key: "Ctrl+T", label: "voice" },
    {
      key: "Esc",
      label: isSlashPalette ? "cancel /" : "back",
    },
    { key: "/quit", label: "exit" },
  ];

  return [
    ...base,
    ...(isChatPending ? [FOOTER_CTRL_C_STOP] : []),
    ...CHAT_COMPOSER_TAIL[tailMode],
  ];
}
