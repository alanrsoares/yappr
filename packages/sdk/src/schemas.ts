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

export const AudioFormatSchema = z.enum(["pcm", "wav", "mp3", "flac", "opus"]);
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

export const YapprSpeechEndpointSchema = z.object({
  kind: z.literal("yappr"),
  baseUrl: z.string().url(),
  voice: VoiceIdSchema.default("af_aoede"),
  speed: z.number().positive().default(1),
});
export type YapprSpeechEndpoint = z.infer<typeof YapprSpeechEndpointSchema>;
export type YapprSpeechEndpointInput = z.input<
  typeof YapprSpeechEndpointSchema
>;

export const OpenAiCompatibleSpeechEndpointSchema = z.object({
  kind: z.literal("openai-compatible"),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  voice: z.string().min(1),
  format: AudioFormatSchema.default("wav"),
  speed: z.number().positive().optional(),
});
export type OpenAiCompatibleSpeechEndpoint = z.infer<
  typeof OpenAiCompatibleSpeechEndpointSchema
>;
export type OpenAiCompatibleSpeechEndpointInput = z.input<
  typeof OpenAiCompatibleSpeechEndpointSchema
>;

export const SpeechEndpointSchema = z.discriminatedUnion("kind", [
  YapprSpeechEndpointSchema,
  OpenAiCompatibleSpeechEndpointSchema,
]);
export type SpeechEndpoint = z.infer<typeof SpeechEndpointSchema>;
export type SpeechEndpointInput = z.input<typeof SpeechEndpointSchema>;

export const YapprTranscriptionEndpointSchema = z.object({
  kind: z.literal("yappr"),
  baseUrl: z.string().url(),
});
export type YapprTranscriptionEndpoint = z.infer<
  typeof YapprTranscriptionEndpointSchema
>;
export type YapprTranscriptionEndpointInput = z.input<
  typeof YapprTranscriptionEndpointSchema
>;

export const OpenAiCompatibleTranscriptionEndpointSchema = z.object({
  kind: z.literal("openai-compatible"),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
});
export type OpenAiCompatibleTranscriptionEndpoint = z.infer<
  typeof OpenAiCompatibleTranscriptionEndpointSchema
>;
export type OpenAiCompatibleTranscriptionEndpointInput = z.input<
  typeof OpenAiCompatibleTranscriptionEndpointSchema
>;

export const TranscriptionEndpointSchema = z.discriminatedUnion("kind", [
  YapprTranscriptionEndpointSchema,
  OpenAiCompatibleTranscriptionEndpointSchema,
]);
export type TranscriptionEndpoint = z.infer<typeof TranscriptionEndpointSchema>;
export type TranscriptionEndpointInput = z.input<
  typeof TranscriptionEndpointSchema
>;

export const VoiceConfigSchema = z.object({
  speech: SpeechEndpointSchema,
  transcription: TranscriptionEndpointSchema,
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type VoiceConfigInput = z.input<typeof VoiceConfigSchema>;

export const SpeechAudioResponseSchema = z.object({
  audio_data: z.string().min(1),
});
export type SpeechAudioResponse = z.infer<typeof SpeechAudioResponseSchema>;

export const OpenAiCompatibleVoicesResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .optional(),
  data: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .optional(),
});
export type OpenAiCompatibleVoicesResponse = z.infer<
  typeof OpenAiCompatibleVoicesResponseSchema
>;

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
