import { z } from "zod";

export const VoiceIdSchema = z
  .string()
  .min(1)
  .describe("Kokoro v1 voice id (e.g. af_aoede, am_adam).");
export type VoiceId = z.infer<typeof VoiceIdSchema>;

export const SynthesizeRequestSchema = z.object({
  text: z.string().min(1).describe("Plain text to speak."),
  voice: VoiceIdSchema.default("af_aoede"),
  speed: z
    .number()
    .positive()
    .default(1)
    .describe("Speaking-rate multiplier (1.0 = model default)."),
});
export type SynthesizeRequest = z.infer<typeof SynthesizeRequestSchema>;
export type SynthesizeRequestInput = z.input<typeof SynthesizeRequestSchema>;

export const VoicesResponseSchema = z.object({
  voices: z.array(VoiceIdSchema),
});
export type VoicesResponse = z.infer<typeof VoicesResponseSchema>;

export const TranscribeResponseSchema = z.object({
  text: z.string(),
});
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;

export const McpServerConfigSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  /** Per-server tool-call timeout in ms. Falls back to manager default. */
  timeoutMs: z.number().int().positive().optional(),
});
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
});
export type McpConfig = z.infer<typeof McpConfigSchema>;
