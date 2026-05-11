import type { ScreenId } from "~/cli/types.js";

export interface SlashCommandContext {
  clearConversation: () => void;
  stopChat: () => void;
  stopStt: () => void;
  quitApp: () => void;
  onBack: () => void;
  navigate: (screen: ScreenId) => void;
  showNotice: (message: string) => void;
  model: string;
  provider: string;
  voice: string;
  useNarrationForTTS: boolean;
}

export interface SlashCommandDef {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly run: (ctx: SlashCommandContext) => void;
}

const SLASH_COMMANDS: readonly SlashCommandDef[] = [
  {
    name: "help",
    description: "List slash commands",
    run: (ctx) => {
      const lines = SLASH_COMMANDS.map(
        (c) =>
          `  /${c.name}${c.aliases?.length ? ` (${c.aliases.join(", ")})` : ""} — ${c.description}`,
      ).join("\n");
      ctx.showNotice(`Commands:\n${lines}`);
    },
  },
  {
    name: "clear",
    aliases: ["reset", "new"],
    description: "Clear this conversation",
    run: (ctx) => {
      ctx.clearConversation();
      ctx.showNotice("Conversation cleared.");
    },
  },
  {
    name: "stop",
    description: "Stop the current reply (same as ctrl+c)",
    run: (ctx) => {
      ctx.stopChat();
      ctx.showNotice("Stop requested.");
    },
  },
  {
    name: "back",
    description: "Return to main menu",
    run: (ctx) => {
      ctx.onBack();
    },
  },
  {
    name: "quit",
    aliases: ["q"],
    description: "Exit yappr (stops chat/STT first)",
    run: (ctx) => {
      ctx.quitApp();
    },
  },
  {
    name: "settings",
    description: "Open Settings",
    run: (ctx) => {
      ctx.navigate("settings");
    },
  },
  {
    name: "voices",
    description: "Open Voices",
    run: (ctx) => {
      ctx.navigate("voices");
    },
  },
  {
    name: "speak",
    description: "Open Speak",
    run: (ctx) => {
      ctx.navigate("speak");
    },
  },
  {
    name: "mcp",
    description: "Open MCP status",
    run: (ctx) => {
      ctx.navigate("mcp");
    },
  },
  {
    name: "model",
    description: "Show current chat model and TTS",
    run: (ctx) => {
      ctx.showNotice(
        `Chat: ${ctx.model} (${ctx.provider})\nTTS voice: ${ctx.voice}\nNarration for TTS: ${ctx.useNarrationForTTS ? "on" : "off"}`,
      );
    },
  },
] as const;

export function listSlashCommands(): readonly SlashCommandDef[] {
  return SLASH_COMMANDS;
}

export function filterSlashCommands(query: string): SlashCommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (c) =>
      c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)) === true,
  );
}

export function resolveSlashCommand(
  token: string,
): SlashCommandDef | undefined {
  const t = token.toLowerCase();
  return SLASH_COMMANDS.find(
    (c) => c.name === t || c.aliases?.some((a) => a === t) === true,
  );
}

export function resolveSlashSubmit(
  rawLine: string,
  explicitPrimaryName: string | undefined,
): SlashCommandDef | undefined {
  const t = rawLine.trim();
  if (!t.startsWith("/")) return undefined;
  const body = t.slice(1).trim();
  const token = body.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (explicitPrimaryName) {
    const byExplicit = SLASH_COMMANDS.find(
      (c) => c.name === explicitPrimaryName,
    );
    if (byExplicit) return byExplicit;
  }

  if (token) {
    const exact = resolveSlashCommand(token);
    if (exact) return exact;
    const matches = filterSlashCommands(token);
    if (matches.length === 1) return matches[0];
  }

  return undefined;
}
