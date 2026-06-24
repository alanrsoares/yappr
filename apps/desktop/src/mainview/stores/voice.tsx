import { useQuery } from "@tanstack/react-query";
import {
  createStoreContext,
  useCreateStore,
  useSelector,
} from "@tanstack/react-store";
import type { Store } from "@tanstack/store";
import { toResultAsync } from "@yappr/lib/effect";
import { DEFAULT_VOICE_CONFIG } from "@yappr/sdk/defaults";
import { type HealthSnapshot, probeHealth } from "@yappr/sdk/health";
import {
  type AudioFormat,
  type VoiceConfig,
  VoiceConfigSchema,
  type VoiceId,
  type VoiceReference,
  VoiceReferenceSchema,
} from "@yappr/sdk/schemas";
import { buildSpeechPreset } from "@yappr/sdk/speech-presets";
import { createVoiceClient } from "@yappr/sdk/voice";
import { type ReactNode, useEffect } from "react";

import {
  type AudioHandle,
  buildAudio,
  DEFAULT_SERVER_URL,
  DEFAULT_SPEED,
  disposeAudio,
  pickVoice,
  toHealthFail,
  toHealthOk,
  toTtsError,
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

/** Voice client/UI state. `voices`/`health` are server state — read via
 * {@link useVoiceHealth} (TanStack Query), not stored here. */
export interface VoiceClientState {
  serverUrl: string;
  voiceConfig: VoiceConfig;
  voiceReference: VoiceReference | null;
  /** Daemon engine snapshot from `GET /health` (which TTS/STT backend is loaded). */
  engineHealth: HealthSnapshot | null;
  voice: VoiceId;
  speed: number;
  tts: TtsState;
  caption: VoiceCaptionState;
}

type SpeakOptions = { messageId?: string };

interface VoiceActions extends Record<string, (...args: never[]) => unknown> {
  setServerUrl: (v: string) => void;
  setSpeechKind: (v: VoiceConfig["speech"]["kind"]) => void;
  setSpeechModel: (v: string) => void;
  setSpeechFormat: (v: AudioFormat) => void;
  setVoice: (v: VoiceId) => void;
  setSpeed: (v: number) => void;
  setVoiceReference: (next: VoiceReference | null) => void;
  checkHealth: () => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  restartAudio: () => void;
  stopAudio: () => void;
  speak: (text: string, options?: SpeakOptions) => Promise<void>;
  transcribe: (blob: Blob) => Promise<string>;
}

type VoiceStore = Store<VoiceClientState, VoiceActions>;

const { StoreProvider, useStoreContext } = createStoreContext<{
  store: VoiceStore;
}>();

/** Access the voice client store. */
export const useVoiceContext = useStoreContext;

const speechSpeed = (speech: VoiceConfig["speech"]) =>
  speech.kind === "yappr" ? speech.speed : (speech.speed ?? DEFAULT_SPEED);

const initialState = (config: VoiceConfig): VoiceClientState => ({
  serverUrl: config.speech.baseUrl,
  voiceConfig: config,
  voiceReference: null,
  engineHealth: null,
  voice: config.speech.voice as VoiceId,
  speed: speechSpeed(config.speech),
  tts: { kind: "idle" },
  caption: { kind: "idle" },
});

// Module-scoped imperative handles — the voice runtime is an app-global
// singleton (one provider at the app root), so these live at module scope.
let audioHandle: AudioHandle | null = null;
const narrationCache = new NarrationCache();
let speakRun = 0;

const persistVoiceConfig = (voice: VoiceConfig) =>
  void dbRpc.request("preferences:setMany", { voice }).catch(() => {});

type Setter = VoiceStore["setState"];
type Getter = VoiceStore["get"];

/** Write a VoiceConfig (with derived fields) and optionally persist it. */
const applyVoiceConfig = (
  setState: Setter,
  next: VoiceConfig,
  persist = true,
): void => {
  setState((s) => ({
    ...s,
    voiceConfig: next,
    serverUrl: next.speech.baseUrl,
    voice: next.speech.voice as VoiceId,
    speed: speechSpeed(next.speech),
  }));
  if (persist) persistVoiceConfig(next);
};

const voiceActionsFactory = ({
  setState,
  get,
}: {
  setState: Setter;
  get: Getter;
}): VoiceActions => {
  const updateSpeech = (
    mutate: (current: VoiceConfig) => VoiceConfig | null,
  ) => {
    const next = mutate(get().voiceConfig);
    if (next) applyVoiceConfig(setState, next);
  };

  return {
    setServerUrl: (next) =>
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
    setSpeechKind: (next) =>
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
    setSpeechModel: (next) =>
      updateSpeech((current) =>
        current.speech.kind !== "openai-compatible"
          ? null
          : VoiceConfigSchema.parse({
              ...current,
              speech: { ...current.speech, model: next },
            }),
      ),
    setSpeechFormat: (next) =>
      updateSpeech((current) =>
        current.speech.kind !== "openai-compatible"
          ? null
          : VoiceConfigSchema.parse({
              ...current,
              speech: { ...current.speech, format: next },
            }),
      ),
    setVoice: (next) =>
      updateSpeech((current) =>
        VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, voice: next },
        }),
      ),
    setSpeed: (next) =>
      updateSpeech((current) =>
        VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, speed: next },
        }),
      ),
    setVoiceReference: (next) => {
      setState((s) => ({ ...s, voiceReference: next }));
      void dbRpc
        .request("preferences:setMany", { voiceReference: next })
        .catch(() => {});
    },
    checkHealth: async () => {
      const speech = get().voiceConfig.speech;
      await queryClient.refetchQueries({
        queryKey: voicesOptions(speech).queryKey,
      });
      if (speech.kind !== "yappr") {
        setState((s) => ({ ...s, engineHealth: null }));
        return;
      }
      const snapshot = await toResultAsync(probeHealth(speech.baseUrl));
      setState((s) => ({
        ...s,
        engineHealth: snapshot.match(
          (snap) => snap,
          () => null,
        ),
      }));
    },
    stopAudio: () => {
      speakRun += 1;
      if (audioHandle) {
        disposeAudio(audioHandle);
        audioHandle = null;
      }
      setState((s) =>
        s.tts.kind === "speaking"
          ? { ...s, tts: { kind: "idle" }, caption: { kind: "idle" } }
          : { ...s, caption: { kind: "idle" } },
      );
    },
    pauseAudio: () => {
      const handle = audioHandle;
      if (!handle) return;
      handle.audio.pause();
      setState((s) =>
        s.caption.kind === "active"
          ? { ...s, caption: { ...s.caption, paused: true } }
          : s,
      );
    },
    resumeAudio: () => {
      const handle = audioHandle;
      if (!handle) return;
      void handle.audio.play().catch((error: unknown) => {
        if (audioHandle !== handle) return;
        disposeAudio(handle);
        audioHandle = null;
        const message =
          error instanceof Error ? error.message : "Audio playback failed";
        setState((s) => ({
          ...s,
          tts: toTtsError(message),
          caption: { kind: "idle" },
        }));
      });
    },
    restartAudio: () => {
      const handle = audioHandle;
      if (!handle) return;
      handle.audio.currentTime = 0;
      setState((s) =>
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
    speak: async (text, options) => {
      const phrase = text.trim();
      if (phrase.length === 0) return;
      // Inline stop (sibling actions aren't reachable from inside the factory).
      speakRun += 1;
      if (audioHandle) {
        disposeAudio(audioHandle);
        audioHandle = null;
      }
      const runId = speakRun;
      const { speech } = get().voiceConfig;
      const voice = speech.voice as VoiceId;
      const speed = speechSpeed(speech);
      const messageId = options?.messageId ?? null;
      setState((s) => ({
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
      const cacheKey = narrationCacheKey({
        speech,
        voice,
        speed,
        text: phrase,
      });
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
          setState((s) => ({
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
          setState((s) => ({
            ...s,
            tts: { kind: "idle" },
            caption: { kind: "idle" },
          }));
        });
        handle.audio.addEventListener("error", () => {
          if (audioHandle !== handle) return;
          disposeAudio(handle);
          audioHandle = null;
          setState((s) => ({
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
          setState((s) => ({
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
      const client = createVoiceClient(get().voiceConfig);
      const reference = get().voiceReference;
      const result = await toResultAsync(
        client.synthesize(phrase, {
          voice,
          speed,
          ...(reference ? { reference } : {}),
        }),
      );
      if (speakRun !== runId) return;
      result.match(
        (buffer) => {
          narrationCache.set(cacheKey, buffer);
          playBuffer(buffer);
        },
        (err) => {
          setState((s) => ({
            ...s,
            tts: toTtsError(err.message),
            caption: { kind: "idle" },
          }));
        },
      );
    },
    transcribe: async (blob) => {
      const client = createVoiceClient(get().voiceConfig);
      const result = await toResultAsync(client.transcribe(blob));
      return result.match(
        (t) => t,
        (err) => {
          throw err;
        },
      );
    },
  };
};

/**
 * Provides the voice store and wires React-only concerns: prefs hydration,
 * the voices health query (to keep the selected voice valid), and audio
 * disposal on unmount. Mount once at the app root.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const store = useCreateStore<VoiceClientState, VoiceActions>(
    initialState(DEFAULT_VOICE_CONFIG),
    voiceActionsFactory,
  );

  const { data: prefs } = useQuery(preferencesOptions);
  useEffect(() => {
    if (!prefs) return;
    const parsed = VoiceConfigSchema.safeParse(prefs.voice);
    applyVoiceConfig(
      store.setState,
      parsed.success ? parsed.data : DEFAULT_VOICE_CONFIG,
      false,
    );
    const ref = VoiceReferenceSchema.safeParse(prefs.voiceReference);
    store.setState((s) => ({
      ...s,
      voiceReference: ref.success ? ref.data : null,
    }));
  }, [Boolean(prefs)]);

  const speech = useSelector(store, (s) => s.voiceConfig.speech);
  const voicesQuery = useQuery(voicesOptions(speech));
  useEffect(() => {
    const voices = voicesQuery.data ?? [];
    if (voices.length === 0) return;
    store.setState((s) => {
      const prev = s.voiceConfig.speech.voice as VoiceId;
      const next = pickVoice(prev)(voices);
      if (next === prev) return s;
      const voiceConfig = VoiceConfigSchema.parse({
        ...s.voiceConfig,
        speech: { ...s.voiceConfig.speech, voice: next },
      });
      return { ...s, voiceConfig, voice: next };
    });
  }, [voicesQuery.data, store]);

  useEffect(
    () => () => {
      if (audioHandle) disposeAudio(audioHandle);
    },
    [],
  );

  return <StoreProvider value={{ store }}>{children}</StoreProvider>;
}

/** Voices list + health, derived from the voices query (server state). */
export function useVoiceHealth(): { voices: VoiceId[]; health: HealthState } {
  const { store } = useVoiceContext();
  const speech = useSelector(store, (s) => s.voiceConfig.speech);
  const q = useQuery(voicesOptions(speech));
  const voices = q.data ?? [];
  const health: HealthState = q.isPending
    ? { kind: "checking" }
    : q.isError
      ? toHealthFail(
          q.error instanceof Error ? q.error.message : "Unknown error",
        )
      : toHealthOk(voices);
  return { voices, health };
}
