import * as z from "zod";

import type { Preferences } from "../types.js";

/** Per-field validation so one bad key does not discard the whole settings file. */
const chatProviderSchema = z.enum(["ollama", "openrouter"]);

const fields = {
  ollamaBaseUrl: z.string().min(1),
  mcpConfigPath: z.string(),
  defaultChatProvider: chatProviderSchema,
  defaultChatModel: z.string(),
  defaultOllamaModel: z.string(),
  defaultVoice: z.string(),
  defaultInputDeviceIndex: z.number().int().nonnegative(),
  defaultOutputDeviceIndex: z.number().int().nonnegative(),
  useNarrationForTTS: z.boolean(),
  narrationModel: z.string(),
  openrouterApiKey: z.string(),
} satisfies Record<
  keyof Preferences | "defaultOllamaModel",
  z.ZodType<unknown>
>;

export type PreferencesJsonPartial = Partial<Preferences> & {
  defaultOllamaModel?: string;
};

/**
 * Parse persisted JSON into a partial preferences object; unknown keys dropped,
 * invalid keys skipped per-field.
 */
export function parsePreferencesJson(raw: unknown): PreferencesJsonPartial {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const src = raw as Record<string, unknown>;
  const out: PreferencesJsonPartial = {};

  for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
    if (!Object.hasOwn(src, key)) continue;
    const parsed = fields[key].safeParse(src[key]);
    if (parsed.success) {
      (out as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return out;
}
