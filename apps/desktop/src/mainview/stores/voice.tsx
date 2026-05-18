import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createContainer } from "@yappr/lib/unstated";
import type { VoiceId } from "@yappr/sdk/schemas";
import { TTSClient } from "@yappr/sdk/tts";

import {
  buildAudio,
  DEFAULT_SERVER_URL,
  DEFAULT_SPEED,
  DEFAULT_VOICE,
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
  health: HealthState;
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
  setVoice: (v: VoiceId) => void;
  setSpeed: (v: number) => void;
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

function useVoiceStoreLogic(): VoiceStoreValue {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [tts, setTts] = useState<TtsState>({ kind: "idle" });
  const [caption, setCaption] = useState<VoiceCaptionState>({ kind: "idle" });
  const audioHandleRef = useRef<AudioHandle | null>(null);
  const narrationCacheRef = useRef(new NarrationCache());
  const speakRunRef = useRef(0);

  // Hydrate from persisted preferences once. The DB is shared with the CLI,
  // so `defaultVoice` round-trips between surfaces. `serverUrl` and `speed`
  // are desktop-only keys today.
  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    if (typeof prefs.serverUrl === "string" && prefs.serverUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServerUrl(prefs.serverUrl);
    }
    if (typeof prefs.defaultVoice === "string" && prefs.defaultVoice) {
      setVoice(prefs.defaultVoice as VoiceId);
    }
    if (typeof prefs.defaultSpeed === "number") {
      setSpeed(prefs.defaultSpeed);
    }
    hydratedRef.current = true;
  }, [prefs]);

  const persistPrefs = useMutation({
    mutationFn: (entries: Record<string, unknown>) =>
      dbRpc.request("preferences:setMany", entries),
  });

  const setServerUrlPersist = useCallback(
    (next: string) => {
      setServerUrl(next);
      persistPrefs.mutate({ serverUrl: next });
    },
    [persistPrefs],
  );
  const setVoicePersist = useCallback(
    (next: VoiceId) => {
      setVoice(next);
      persistPrefs.mutate({ defaultVoice: next });
    },
    [persistPrefs],
  );
  const setSpeedPersist = useCallback(
    (next: number) => {
      setSpeed(next);
      persistPrefs.mutate({ defaultSpeed: next });
    },
    [persistPrefs],
  );
  const client = useMemo(() => new TTSClient(serverUrl), [serverUrl]);

  // Backend connectivity probe + voice list. Auto-fires on mount, polls every
  // 30s, refetches on focus and on serverUrl change. The query state IS the
  // health state — no separate manual machine needed.
  const voicesQuery = useQuery(voicesOptions(serverUrl));
  const voices = useMemo(() => voicesQuery.data ?? [], [voicesQuery.data]);

  const health = useMemo<HealthState>(() => {
    if (voicesQuery.isPending) return { kind: "checking" };
    if (voicesQuery.isError) {
      const err = voicesQuery.error;
      return toHealthFail(err instanceof Error ? err.message : "Unknown error");
    }
    return toHealthOk(voices);
  }, [voicesQuery.isPending, voicesQuery.isError, voicesQuery.error, voices]);

  // When the voice list changes, ensure the selected voice is still valid.
  useEffect(() => {
    if (voices.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoice((prev) => pickVoice(prev)(voices));
  }, [voices]);

  const checkHealth = useCallback(async () => {
    await voicesQuery.refetch();
  }, [voicesQuery]);

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
        serverUrl,
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
      const result = await client.synthesize(phrase, { voice, speed });
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
    [client, serverUrl, voice, speed, stopAudio],
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

  const state = {
    serverUrl,
    health,
    voices,
    voice,
    speed,
    tts,
    caption,
  };

  const actions = {
    setServerUrl: setServerUrlPersist,
    setVoice: setVoicePersist,
    setSpeed: setSpeedPersist,
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
