export type { AudioDevice } from "./audio.js";
export {
  createAudioRuntime,
  createPlaybackPort,
  getDefaultAudioRuntime,
  listInputDevices,
  listOutputDevices,
  listVoices,
  listVoicesWithRuntime,
  recordAndTranscribe,
  recordAndTranscribeWithRuntime,
  resetDefaultAudioRuntimeForTests,
  resolveAudioPaths,
  speak,
  speakWithRuntime,
  stopAudioPlayback,
} from "./audio.js";
export type {
  AudioPaths,
  AudioRuntime,
  PlaybackPort,
  RecorderPort,
  TtsPort,
} from "./audio.js";
export type { RecordAndTranscribeOptions } from "./audio.js";

export {
  buildChatModelMessages,
  chat,
  createDefaultChatRuntime,
  defaultChatRuntime,
} from "./chat/index.js";
export type { ChatRuntime } from "./chat/index.js";

export type { OpenRouterModelInfo } from "./openrouter.js";
export { listOpenRouterModels } from "./openrouter.js";

export { listOllamaModels } from "./ollama.js";
