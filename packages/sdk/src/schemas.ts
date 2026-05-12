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
    .default(1.0)
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
