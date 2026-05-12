import type { ScreenId } from "~/types.js";

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

function runSlashHelp(ctx: SlashCommandContext) {
  const lines = SLASH_COMMANDS.map(
    (c) =>
      `  /${c.name}${c.aliases?.length ? ` (${c.aliases.join(", ")})` : ""} — ${c.description}`,
  ).join("\n");
  ctx.showNotice(`Commands:\n${lines}`);
}

function runSlashClear(ctx: SlashCommandContext) {
  ctx.clearConversation();
  ctx.showNotice("Conversation cleared.");
}

function runSlashStop(ctx: SlashCommandContext) {
  ctx.stopChat();
  ctx.showNotice("Stop requested.");
}

function runSlashModel(ctx: SlashCommandContext) {
  ctx.showNotice(
    `Chat: ${ctx.model} (${ctx.provider})\nTTS voice: ${ctx.voice}\nNarration for TTS: ${ctx.useNarrationForTTS ? "on" : "off"}`,
  );
}

const SLASH_COMMANDS: readonly SlashCommandDef[] = [
  {
    name: "help",
    description: "List slash commands",
    run: runSlashHelp,
  },
  {
    name: "clear",
    aliases: ["reset", "new"],
    description: "Clear this conversation",
    run: runSlashClear,
  },
  {
    name: "stop",
    description: "Stop the current reply (same as ctrl+c)",
    run: runSlashStop,
  },
  {
    name: "back",
    description: "Return to main menu",
    run: (ctx) => ctx.onBack(),
  },
  {
    name: "quit",
    aliases: ["q"],
    description: "Exit yappr (stops chat/STT first)",
    run: (ctx) => ctx.quitApp(),
  },
  {
    name: "settings",
    description: "Open Settings",
    run: (ctx) => ctx.navigate("settings"),
  },
  {
    name: "voices",
    description: "Open Voices",
    run: (ctx) => ctx.navigate("voices"),
  },
  {
    name: "speak",
    description: "Open Speak",
    run: (ctx) => ctx.navigate("speak"),
  },
  {
    name: "mcp",
    description: "Open MCP status",
    run: (ctx) => ctx.navigate("mcp"),
  },
  {
    name: "model",
    description: "Show current chat model and TTS",
    run: runSlashModel,
  },
] as const;

/** Primary name → command (for palette explicit selection). */
const SLASH_BY_PRIMARY_NAME = new Map(
  SLASH_COMMANDS.map((c) => [c.name, c] as const),
);

/**
 * Normalized token → command (name + aliases; first registered wins on alias
 * collision).
 */
const SLASH_BY_TOKEN = new Map<string, SlashCommandDef>();
for (const cmd of SLASH_COMMANDS) {
  const nameKey = cmd.name.toLowerCase();
  SLASH_BY_TOKEN.set(nameKey, cmd);
  for (const a of cmd.aliases ?? []) {
    const k = a.toLowerCase();
    if (!SLASH_BY_TOKEN.has(k)) SLASH_BY_TOKEN.set(k, cmd);
  }
}

export function listSlashCommands() {
  return SLASH_COMMANDS;
}

export function filterSlashCommands(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (c) =>
      c.name.startsWith(q) || Boolean(c.aliases?.some((a) => a.startsWith(q))),
  );
}

export function resolveSlashCommand(token: string) {
  return SLASH_BY_TOKEN.get(token.toLowerCase());
}

export function resolveSlashSubmit(
  rawLine: string,
  explicitPrimaryName: string | undefined,
) {
  const t = rawLine.trim();
  if (!t.startsWith("/")) return undefined;
  const body = t.slice(1).trim();
  const token = body.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (explicitPrimaryName) {
    const byExplicit = SLASH_BY_PRIMARY_NAME.get(explicitPrimaryName);
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
