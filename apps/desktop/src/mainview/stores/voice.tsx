import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createContainer } from "@yappr/lib/unstated";
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

type VoiceStoreActions = {
  setServerUrl: (v: string) => void;
  setSpeechKind: (v: VoiceConfig["speech"]["kind"]) => void;
  setSpeechModel: (v: string) => void;
  setSpeechFormat: (v: AudioFormat) => void;
  setVoice: (v: VoiceId) => void;
  setSpeed: (v: number) => void;
  /** Dia voice-clone reference. Pass `null` to disable cloning. */
  setVoiceReference: (next: VoiceReference | null) => void;
  /** Force a backend re-probe (delegates to TanStack Query refetch). */
  checkHealth: () => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  restartAudio: () => void;
  stopAudio: () => void;
  /** Speak the given text; no-op on empty. */
  speak: (text: string, options?: SpeakOptions) => Promise<void>;
  /** Send a recorded audio Blob to the STT endpoint. Resolves with transcript. */
  transcribe: (blob: Blob) => Promise<string>;
};

type VoiceStoreValue = readonly [VoiceStoreState, VoiceStoreActions];

const speechSpeed = (speech: VoiceConfig["speech"]) =>
  speech.kind === "yappr" ? speech.speed : (speech.speed ?? DEFAULT_SPEED);

function useVoiceStoreLogic(): VoiceStoreValue {
  const [voiceConfig, setVoiceConfig] =
    useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [voiceReference, setVoiceReferenceState] =
    useState<VoiceReference | null>(null);
  const [engineHealth, setEngineHealth] = useState<HealthSnapshot | null>(null);
  const [tts, setTts] = useState<TtsState>({ kind: "idle" });
  const [caption, setCaption] = useState<VoiceCaptionState>({ kind: "idle" });
  const audioHandleRef = useRef<AudioHandle | null>(null);
  const narrationCacheRef = useRef(new NarrationCache());
  const speakRunRef = useRef(0);

  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    const parsed = VoiceConfigSchema.safeParse(prefs.voice);
    setVoiceConfig(parsed.success ? parsed.data : DEFAULT_VOICE_CONFIG);
    const ref = VoiceReferenceSchema.safeParse(prefs.voiceReference);
    setVoiceReferenceState(ref.success ? ref.data : null);
    hydratedRef.current = true;
  }, [prefs]);

  const persistPrefs = useMutation({
    mutationFn: (voice: VoiceConfig) =>
      dbRpc.request("preferences:setMany", { voice }),
  });

  const persistVoiceConfig = useCallback(
    (nextConfig: VoiceConfig) => {
      persistPrefs.mutate(nextConfig);
    },
    [persistPrefs],
  );

  const persistReferencePrefs = useMutation({
    mutationFn: (ref: VoiceReference | null) =>
      dbRpc.request("preferences:setMany", { voiceReference: ref }),
  });
  const setVoiceReference = useCallback(
    (next: VoiceReference | null) => {
      setVoiceReferenceState(next);
      persistReferencePrefs.mutate(next);
    },
    [persistReferencePrefs],
  );

  const setServerUrlPersist = useCallback(
    (next: string) => {
      setVoiceConfig((current) => {
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, baseUrl: next },
          transcription:
            current.speech.kind === "yappr" &&
            current.transcription.kind === "yappr"
              ? { ...current.transcription, baseUrl: next }
              : current.transcription,
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const setSpeechKindPersist = useCallback(
    (next: VoiceConfig["speech"]["kind"]) => {
      setVoiceConfig((current) => {
        if (current.speech.kind === next) return current;
        const voice = current.speech.voice as VoiceId;
        const speed = speechSpeed(current.speech);
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech:
            next === "yappr"
              ? {
                  kind: "yappr",
                  baseUrl: DEFAULT_SERVER_URL,
                  voice,
                  speed,
                }
              : { ...buildSpeechPreset("voxtral"), speed },
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const setSpeechModelPersist = useCallback(
    (next: string) => {
      setVoiceConfig((current) => {
        if (current.speech.kind !== "openai-compatible") return current;
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, model: next },
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const setSpeechFormatPersist = useCallback(
    (next: AudioFormat) => {
      setVoiceConfig((current) => {
        if (current.speech.kind !== "openai-compatible") return current;
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, format: next },
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const setVoicePersist = useCallback(
    (next: VoiceId) => {
      setVoiceConfig((current) => {
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, voice: next },
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const setSpeedPersist = useCallback(
    (next: number) => {
      setVoiceConfig((current) => {
        const nextConfig = VoiceConfigSchema.parse({
          ...current,
          speech: { ...current.speech, speed: next },
        });
        persistVoiceConfig(nextConfig);
        return nextConfig;
      });
    },
    [persistVoiceConfig],
  );
  const client = useMemo(() => createVoiceClient(voiceConfig), [voiceConfig]);

  const voicesQuery = useQuery(voicesOptions(voiceConfig.speech));
  const voices = useMemo(() => voicesQuery.data ?? [], [voicesQuery.data]);

  const health = useMemo<HealthState>(() => {
    if (voicesQuery.isPending) return { kind: "checking" };
    if (voicesQuery.isError) {
      const err = voicesQuery.error;
      return toHealthFail(err instanceof Error ? err.message : "Unknown error");
    }
    return toHealthOk(voices);
  }, [voicesQuery.isPending, voicesQuery.isError, voicesQuery.error, voices]);

  useEffect(() => {
    if (voices.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceConfig((current) => {
      const prev = current.speech.voice as VoiceId;
      const next = pickVoice(prev)(voices);
      if (next === prev) return current;
      return VoiceConfigSchema.parse({
        ...current,
        speech: { ...current.speech, voice: next },
      });
    });
  }, [voices]);

  const checkHealth = useCallback(async () => {
    await voicesQuery.refetch();
    const speech = voiceConfig.speech;
    if (speech.kind !== "yappr") {
      setEngineHealth(null);
      return;
    }
    const snapshot = await probeHealth(speech.baseUrl);
    setEngineHealth(
      snapshot.match(
        (s) => s,
        () => null,
      ),
    );
  }, [voicesQuery, voiceConfig.speech]);

  const stopAudio = useCallback(() => {
    speakRunRef.current += 1;
    if (audioHandleRef.current) {
      disposeAudio(audioHandleRef.current);
      audioHandleRef.current = null;
    }
    setTts((prev) => (prev.kind === "speaking" ? { kind: "idle" } : prev));
    setCaption({ kind: "idle" });
  }, []);

  const pauseAudio = useCallback(() => {
    const handle = audioHandleRef.current;
    if (!handle) return;
    handle.audio.pause();
    setCaption((prev) =>
      prev.kind === "active" ? { ...prev, paused: true } : prev,
    );
  }, []);

  const resumeAudio = useCallback(() => {
    const handle = audioHandleRef.current;
    if (!handle) return;
    void handle.audio.play().catch((error: unknown) => {
      if (audioHandleRef.current !== handle) return;
      disposeAudio(handle);
      audioHandleRef.current = null;
      const message =
        error instanceof Error ? error.message : "Audio playback failed";
      setTts(toTtsError(message));
      setCaption({ kind: "idle" });
    });
  }, []);

  const restartAudio = useCallback(() => {
    const handle = audioHandleRef.current;
    if (!handle) return;
    handle.audio.currentTime = 0;
    setCaption((prev) =>
      prev.kind === "active"
        ? {
            ...prev,
            currentTime: 0,
            progress: 0,
            paused: handle.audio.paused,
          }
        : prev,
    );
  }, []);

  const speak = useCallback(
    async (text: string, options?: SpeakOptions) => {
      const phrase = text.trim();
      if (phrase.length === 0) return;
      stopAudio();
      const runId = speakRunRef.current;
      const { speech } = voiceConfig;
      const voice = speech.voice as VoiceId;
      const speed = speechSpeed(speech);
      setTts({ kind: "speaking" });
      const messageId = options?.messageId ?? null;
      setCaption({
        kind: "active",
        messageId,
        text: phrase,
        currentTime: 0,
        duration: 0,
        progress: 0,
        paused: false,
      });
      const cacheKey = narrationCacheKey({
        speech,
        voice,
        speed,
        text: phrase,
      });
      const playBuffer = (buffer: ArrayBuffer) => {
        if (speakRunRef.current !== runId) return;
        const handle = buildAudio(buffer);
        audioHandleRef.current = handle;
        const updateCaption = () => {
          if (audioHandleRef.current !== handle) return;
          const duration = Number.isFinite(handle.audio.duration)
            ? handle.audio.duration
            : 0;
          const currentTime = handle.audio.currentTime;
          setCaption({
            kind: "active",
            messageId,
            text: phrase,
            currentTime,
            duration,
            progress: duration > 0 ? currentTime / duration : 0,
            paused: handle.audio.paused,
          });
        };
        updateCaption();
        handle.audio.addEventListener("loadedmetadata", updateCaption);
        handle.audio.addEventListener("pause", updateCaption);
        handle.audio.addEventListener("play", updateCaption);
        handle.audio.addEventListener("playing", updateCaption);
        handle.audio.addEventListener("timeupdate", updateCaption);
        handle.audio.addEventListener("ended", () => {
          if (audioHandleRef.current !== handle) return;
          disposeAudio(handle);
          audioHandleRef.current = null;
          setTts({ kind: "idle" });
          setCaption({ kind: "idle" });
        });
        handle.audio.addEventListener("error", () => {
          if (audioHandleRef.current !== handle) return;
          disposeAudio(handle);
          audioHandleRef.current = null;
          setTts(toTtsError("Audio playback failed"));
          setCaption({ kind: "idle" });
        });
        void handle.audio.play().catch((error: unknown) => {
          if (audioHandleRef.current !== handle) return;
          disposeAudio(handle);
          audioHandleRef.current = null;
          const message =
            error instanceof Error ? error.message : "Audio playback failed";
          setTts(toTtsError(message));
          setCaption({ kind: "idle" });
        });
      };
      const cached = narrationCacheRef.current.get(cacheKey);
      if (cached.isOk()) {
        playBuffer(cached.value);
        return;
      }
      const result = await client.synthesize(phrase, {
        voice,
        speed,
        ...(voiceReference ? { reference: voiceReference } : {}),
      });
      if (speakRunRef.current !== runId) return;
      result.match(
        (buffer) => {
          narrationCacheRef.current.set(cacheKey, buffer);
          playBuffer(buffer);
        },
        (err) => {
          setTts(toTtsError(err.message));
          setCaption({ kind: "idle" });
        },
      );
    },
    [client, voiceConfig, voiceReference, stopAudio],
  );

  const transcribe = useCallback(
    async (blob: Blob): Promise<string> => {
      const result = await client.transcribe(blob);
      return result.match(
        (t) => t,
        (err) => {
          throw err;
        },
      );
    },
    [client],
  );

  useEffect(
    () => () => {
      if (audioHandleRef.current) disposeAudio(audioHandleRef.current);
    },
    [],
  );

  const speech = voiceConfig.speech;
  const state = {
    serverUrl: speech.baseUrl,
    voiceConfig,
    voiceReference,
    health,
    engineHealth,
    voices,
    voice: speech.voice as VoiceId,
    speed: speechSpeed(speech),
    tts,
    caption,
  };

  const actions = {
    setServerUrl: setServerUrlPersist,
    setSpeechKind: setSpeechKindPersist,
    setSpeechModel: setSpeechModelPersist,
    setSpeechFormat: setSpeechFormatPersist,
    setVoice: setVoicePersist,
    setSpeed: setSpeedPersist,
    setVoiceReference,
    checkHealth,
    pauseAudio,
    resumeAudio,
    restartAudio,
    stopAudio,
    speak,
    transcribe,
  };

  return [state, actions] as const;
}

export const { useContainer: useVoiceStore, Provider: VoiceStoreProvider } =
  createContainer<VoiceStoreValue>(useVoiceStoreLogic);
