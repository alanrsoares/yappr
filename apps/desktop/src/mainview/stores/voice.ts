import { useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import { DEFAULT_VOICE_CONFIG } from "@yappr/sdk/defaults";
import { probeHealth, type HealthSnapshot } from "@yappr/sdk/health";
import {
  VoiceConfigSchema,
  VoiceReferenceSchema,
  type AudioFormat,
  type VoiceConfig,
  type VoiceId,
  type VoiceReference,
} from "@yappr/sdk/schemas";
import { buildSpeechPreset } from "@yappr/sdk/speech-presets";
import { createVoiceClient } from "@yappr/sdk/voice";

import {
  buildAudio,
  DEFAULT_SERVER_URL,
  DEFAULT_SPEED,
  disposeAudio,
  pickVoice,
  toHealthFail,
  toHealthOk,
  toTtsError,
  type AudioHandle,
} from "~/lib/audio";
import { dbRpc } from "~/lib/db-rpc";
import { NarrationCache, narrationCacheKey } from "~/lib/narration-cache";
import { preferencesOptions, voicesOptions } from "~/lib/queries";
import { queryClient } from "~/lib/query-client";
import type { HealthState, TtsState } from "~/types";

export type VoiceCaptionState =
  | { kind: "idle" }
  | {
      kind: "active";
      messageId: string | null;
      text: string;
      currentTime: number;
      duration: number;
      progress: number;
      paused: boolean;
    };

export type VoiceStoreState = {
  serverUrl: string;
  voiceConfig: VoiceConfig;
  voiceReference: VoiceReference | null;
  health: HealthState;
  /** Daemon engine snapshot from `GET /health` (which TTS/STT backend is loaded). */
  engineHealth: HealthSnapshot | null;
  voices: VoiceId[];
  voice: VoiceId;
  speed: number;
  tts: TtsState;
  caption: VoiceCaptionState;
};

type SpeakOptions = {
  messageId?: string;
};

const speechSpeed = (speech: VoiceConfig["speech"]) =>
  speech.kind === "yappr" ? speech.speed : (speech.speed ?? DEFAULT_SPEED);

const initialConfig = DEFAULT_VOICE_CONFIG;

export const voiceStore = new Store<VoiceStoreState>({
  serverUrl: initialConfig.speech.baseUrl,
  voiceConfig: initialConfig,
  voiceReference: null,
  health: { kind: "checking" },
  engineHealth: null,
  voices: [],
  voice: initialConfig.speech.voice as VoiceId,
  speed: speechSpeed(initialConfig.speech),
  tts: { kind: "idle" },
  caption: { kind: "idle" },
});

// Module-scoped imperative handles — the voice runtime is an app-global
// singleton, so these live alongside the store rather than in React refs.
let audioHandle: AudioHandle | null = null;
const narrationCache = new NarrationCache();
let speakRun = 0;

const persistVoiceConfig = (voice: VoiceConfig) => {
  void dbRpc.request("preferences:setMany", { voice }).catch(() => {});
};

/** Write a new VoiceConfig into the store (keeping derived fields in sync) and persist it. */
const applyVoiceConfig = (next: VoiceConfig, persist = true): void => {
  voiceStore.setState((s) => ({
    ...s,
    voiceConfig: next,
    serverUrl: next.speech.baseUrl,
    voice: next.speech.voice as VoiceId,
    speed: speechSpeed(next.speech),
  }));
  if (persist) persistVoiceConfig(next);
};

const updateSpeech = (
  mutate: (current: VoiceConfig) => VoiceConfig | null,
): void => {
  const next = mutate(voiceStore.state.voiceConfig);
  if (next) applyVoiceConfig(next);
};

export const voiceActions = {
  setServerUrl: (next: string): void =>
    updateSpeech((current) =>
      VoiceConfigSchema.parse({
        ...current,
        speech: { ...current.speech, baseUrl: next },
        transcription:
          current.speech.kind === "yappr" &&
          current.transcription.kind === "yappr"
            ? { ...current.transcription, baseUrl: next }
            : current.transcription,
      }),
    ),
  setSpeechKind: (next: VoiceConfig["speech"]["kind"]): void =>
    updateSpeech((current) => {
      if (current.speech.kind === next) return null;
      const voice = current.speech.voice as VoiceId;
      const speed = speechSpeed(current.speech);
      return VoiceConfigSchema.parse({
        ...current,
        speech:
          next === "yappr"
            ? { kind: "yappr", baseUrl: DEFAULT_SERVER_URL, voice, speed }
            : { ...buildSpeechPreset("voxtral"), speed },
      });
    }),
  setSpeechModel: (next: string): void =>
    updateSpeech((current) =>
      current.speech.kind !== "openai-compatible"
        ? null
        : VoiceConfigSchema.parse({
            ...current,
            speech: { ...current.speech, model: next },
          }),
    ),
  setSpeechFormat: (next: AudioFormat): void =>
    updateSpeech((current) =>
      current.speech.kind !== "openai-compatible"
        ? null
        : VoiceConfigSchema.parse({
            ...current,
            speech: { ...current.speech, format: next },
          }),
    ),
  setVoice: (next: VoiceId): void =>
    updateSpeech((current) =>
      VoiceConfigSchema.parse({
        ...current,
        speech: { ...current.speech, voice: next },
      }),
    ),
  setSpeed: (next: number): void =>
    updateSpeech((current) =>
      VoiceConfigSchema.parse({
        ...current,
        speech: { ...current.speech, speed: next },
      }),
    ),
  setVoiceReference: (next: VoiceReference | null): void => {
    voiceStore.setState((s) => ({ ...s, voiceReference: next }));
    void dbRpc
      .request("preferences:setMany", { voiceReference: next })
      .catch(() => {});
  },
  checkHealth: async (): Promise<void> => {
    const speech = voiceStore.state.voiceConfig.speech;
    await queryClient.refetchQueries({
      queryKey: voicesOptions(speech).queryKey,
    });
    if (speech.kind !== "yappr") {
      voiceStore.setState((s) => ({ ...s, engineHealth: null }));
      return;
    }
    const snapshot = await probeHealth(speech.baseUrl);
    voiceStore.setState((s) => ({
      ...s,
      engineHealth: snapshot.match(
        (snap) => snap,
        () => null,
      ),
    }));
  },
  stopAudio: (): void => {
    speakRun += 1;
    if (audioHandle) {
      disposeAudio(audioHandle);
      audioHandle = null;
    }
    voiceStore.setState((s) =>
      s.tts.kind === "speaking"
        ? { ...s, tts: { kind: "idle" }, caption: { kind: "idle" } }
        : { ...s, caption: { kind: "idle" } },
    );
  },
  pauseAudio: (): void => {
    const handle = audioHandle;
    if (!handle) return;
    handle.audio.pause();
    voiceStore.setState((s) =>
      s.caption.kind === "active"
        ? { ...s, caption: { ...s.caption, paused: true } }
        : s,
    );
  },
  resumeAudio: (): void => {
    const handle = audioHandle;
    if (!handle) return;
    void handle.audio.play().catch((error: unknown) => {
      if (audioHandle !== handle) return;
      disposeAudio(handle);
      audioHandle = null;
      const message =
        error instanceof Error ? error.message : "Audio playback failed";
      voiceStore.setState((s) => ({
        ...s,
        tts: toTtsError(message),
        caption: { kind: "idle" },
      }));
    });
  },
  restartAudio: (): void => {
    const handle = audioHandle;
    if (!handle) return;
    handle.audio.currentTime = 0;
    voiceStore.setState((s) =>
      s.caption.kind === "active"
        ? {
            ...s,
            caption: {
              ...s.caption,
              currentTime: 0,
              progress: 0,
              paused: handle.audio.paused,
            },
          }
        : s,
    );
  },
  speak: async (text: string, options?: SpeakOptions): Promise<void> => {
    const phrase = text.trim();
    if (phrase.length === 0) return;
    voiceActions.stopAudio();
    const runId = speakRun;
    const { speech } = voiceStore.state.voiceConfig;
    const voice = speech.voice as VoiceId;
    const speed = speechSpeed(speech);
    const messageId = options?.messageId ?? null;
    voiceStore.setState((s) => ({
      ...s,
      tts: { kind: "speaking" },
      caption: {
        kind: "active",
        messageId,
        text: phrase,
        currentTime: 0,
        duration: 0,
        progress: 0,
        paused: false,
      },
    }));
    const cacheKey = narrationCacheKey({ speech, voice, speed, text: phrase });
    const playBuffer = (buffer: ArrayBuffer) => {
      if (speakRun !== runId) return;
      const handle = buildAudio(buffer);
      audioHandle = handle;
      const updateCaption = () => {
        if (audioHandle !== handle) return;
        const duration = Number.isFinite(handle.audio.duration)
          ? handle.audio.duration
          : 0;
        const currentTime = handle.audio.currentTime;
        voiceStore.setState((s) => ({
          ...s,
          caption: {
            kind: "active",
            messageId,
            text: phrase,
            currentTime,
            duration,
            progress: duration > 0 ? currentTime / duration : 0,
            paused: handle.audio.paused,
          },
        }));
      };
      updateCaption();
      handle.audio.addEventListener("loadedmetadata", updateCaption);
      handle.audio.addEventListener("pause", updateCaption);
      handle.audio.addEventListener("play", updateCaption);
      handle.audio.addEventListener("playing", updateCaption);
      handle.audio.addEventListener("timeupdate", updateCaption);
      handle.audio.addEventListener("ended", () => {
        if (audioHandle !== handle) return;
        disposeAudio(handle);
        audioHandle = null;
        voiceStore.setState((s) => ({
          ...s,
          tts: { kind: "idle" },
          caption: { kind: "idle" },
        }));
      });
      handle.audio.addEventListener("error", () => {
        if (audioHandle !== handle) return;
        disposeAudio(handle);
        audioHandle = null;
        voiceStore.setState((s) => ({
          ...s,
          tts: toTtsError("Audio playback failed"),
          caption: { kind: "idle" },
        }));
      });
      void handle.audio.play().catch((error: unknown) => {
        if (audioHandle !== handle) return;
        disposeAudio(handle);
        audioHandle = null;
        const message =
          error instanceof Error ? error.message : "Audio playback failed";
        voiceStore.setState((s) => ({
          ...s,
          tts: toTtsError(message),
          caption: { kind: "idle" },
        }));
      });
    };
    const cached = narrationCache.get(cacheKey);
    if (cached.isOk()) {
      playBuffer(cached.value);
      return;
    }
    const client = createVoiceClient(voiceStore.state.voiceConfig);
    const result = await client.synthesize(phrase, {
      voice,
      speed,
      ...(voiceStore.state.voiceReference
        ? { reference: voiceStore.state.voiceReference }
        : {}),
    });
    if (speakRun !== runId) return;
    result.match(
      (buffer) => {
        narrationCache.set(cacheKey, buffer);
        playBuffer(buffer);
      },
      (err) => {
        voiceStore.setState((s) => ({
          ...s,
          tts: toTtsError(err.message),
          caption: { kind: "idle" },
        }));
      },
    );
  },
  transcribe: async (blob: Blob): Promise<string> => {
    const client = createVoiceClient(voiceStore.state.voiceConfig);
    const result = await client.transcribe(blob);
    return result.match(
      (t) => t,
      (err) => {
        throw err;
      },
    );
  },
};

/**
 * Mount-once runtime that wires React-only concerns into {@link voiceStore}:
 * hydrates from persisted prefs, drives the voices health query, keeps the
 * selected voice valid, and disposes audio on unmount. Render once at the app
 * root; consumers then read via `useStore(voiceStore, selector)` and call
 * {@link voiceActions} directly.
 */
export function useVoiceRuntime(): void {
  const { data: prefs } = useQuery(preferencesOptions);
  useEffect(() => {
    if (!prefs) return;
    const parsed = VoiceConfigSchema.safeParse(prefs.voice);
    applyVoiceConfig(
      parsed.success ? parsed.data : DEFAULT_VOICE_CONFIG,
      false,
    );
    const ref = VoiceReferenceSchema.safeParse(prefs.voiceReference);
    voiceStore.setState((s) => ({
      ...s,
      voiceReference: ref.success ? ref.data : null,
    }));
    // Hydrate once from the first prefs payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(prefs)]);

  const speech = useSelector(voiceStore, (s) => s.voiceConfig.speech);
  const voicesQuery = useQuery(voicesOptions(speech));

  useEffect(() => {
    const voices = voicesQuery.data ?? [];
    const health: HealthState = voicesQuery.isPending
      ? { kind: "checking" }
      : voicesQuery.isError
        ? toHealthFail(
            voicesQuery.error instanceof Error
              ? voicesQuery.error.message
              : "Unknown error",
          )
        : toHealthOk(voices);
    voiceStore.setState((s) => {
      const prev = s.voiceConfig.speech.voice as VoiceId;
      const nextVoice = voices.length > 0 ? pickVoice(prev)(voices) : prev;
      const voiceConfig =
        nextVoice === prev
          ? s.voiceConfig
          : VoiceConfigSchema.parse({
              ...s.voiceConfig,
              speech: { ...s.voiceConfig.speech, voice: nextVoice },
            });
      return {
        ...s,
        voices,
        health,
        voiceConfig,
        voice: voiceConfig.speech.voice as VoiceId,
      };
    });
  }, [
    voicesQuery.data,
    voicesQuery.isPending,
    voicesQuery.isError,
    voicesQuery.error,
  ]);

  useEffect(
    () => () => {
      if (audioHandle) disposeAudio(audioHandle);
    },
    [],
  );
}
