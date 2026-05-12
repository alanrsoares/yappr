import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useQuery } from "@tanstack/react-query";

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
import { voicesOptions } from "~/lib/queries";
import { TTSClient, type VoiceId } from "~/services/yappr";
import type { HealthState, TtsState } from "~/types";

type VoiceStoreContextValue = {
  serverUrl: string;
  setServerUrl: (v: string) => void;
  health: HealthState;
  voices: VoiceId[];
  voice: VoiceId;
  setVoice: (v: VoiceId) => void;
  speed: number;
  setSpeed: (v: number) => void;
  tts: TtsState;
  /** Force a backend re-probe (delegates to TanStack Query refetch). */
  checkHealth: () => Promise<void>;
  stopAudio: () => void;
  /** Speak the given text; no-op on empty. */
  speak: (text: string) => Promise<void>;
  /** Send a recorded audio Blob to the STT endpoint. Resolves with transcript. */
  transcribe: (blob: Blob) => Promise<string>;
};

const VoiceStoreContext = createContext<VoiceStoreContextValue | null>(null);

export function useVoiceStore() {
  const ctx = useContext(VoiceStoreContext);
  if (!ctx) {
    throw new Error("useVoiceStore must be used within VoiceStoreProvider");
  }
  return ctx;
}

export function VoiceStoreProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [tts, setTts] = useState<TtsState>({ kind: "idle" });
  const audioHandleRef = useRef<AudioHandle | null>(null);

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
    setVoice((prev) => pickVoice(prev)(voices));
  }, [voices]);

  const checkHealth = useCallback(async () => {
    await voicesQuery.refetch();
  }, [voicesQuery]);

  const stopAudio = useCallback(() => {
    if (audioHandleRef.current) {
      disposeAudio(audioHandleRef.current);
      audioHandleRef.current = null;
    }
    setTts((prev) => (prev.kind === "speaking" ? { kind: "idle" } : prev));
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const phrase = text.trim();
      if (phrase.length === 0) return;
      stopAudio();
      setTts({ kind: "speaking" });
      const result = await client.synthesize(phrase, { voice, speed });
      result.match(
        (buffer) => {
          const handle = buildAudio(buffer);
          audioHandleRef.current = handle;
          handle.audio.onended = () => {
            disposeAudio(handle);
            if (audioHandleRef.current === handle)
              audioHandleRef.current = null;
            setTts({ kind: "idle" });
          };
          handle.audio.onerror = () => {
            disposeAudio(handle);
            setTts(toTtsError("Audio playback failed"));
          };
          void handle.audio.play();
        },
        (err) => setTts(toTtsError(err.message)),
      );
    },
    [client, voice, speed, stopAudio],
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

  const value = useMemo<VoiceStoreContextValue>(
    () => ({
      serverUrl,
      setServerUrl,
      health,
      voices,
      voice,
      setVoice,
      speed,
      setSpeed,
      tts,
      checkHealth,
      stopAudio,
      speak,
      transcribe,
    }),
    [
      serverUrl,
      health,
      voices,
      voice,
      speed,
      tts,
      checkHealth,
      stopAudio,
      speak,
      transcribe,
    ],
  );

  return (
    <VoiceStoreContext.Provider value={value}>
      {children}
    </VoiceStoreContext.Provider>
  );
}
