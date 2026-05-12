/**
 * Named Ink colors by role. Prefer these over string literals in components
 * so accents and status hues stay consistent (see AGENTS.md → TUI patterns).
 */
export const semantic = {
  accent: "cyan",
  frame: "gray",
  notice: "yellow",
  error: "red",
  success: "green",
  border: {
    composer: "cyan",
    historyFrame: "gray",
    userBubble: "green",
    assistantBubble: "cyan",
    streaming: "cyan",
  },
} as const;
