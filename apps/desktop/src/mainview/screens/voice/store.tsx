import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  buildAudio,
  DEFAULT_SERVER_URL,
  DEFAULT_SPEED,
  DEFAULT_TEXT,
  DEFAULT_VOICE,
  disposeAudio,
  pickVoice,
  toHealthFail,
  toHealthOk,
  toTtsError,
  type AudioHandle,
} from "~/lib/audio";
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
  text: string;
  setText: (v: string) => void;
  tts: TtsState;
  audioElement: HTMLAudioElement | null;
  checkHealth: () => Promise<void>;
  onCheckSubmit: (e: FormEvent<HTMLFormElement>) => void;
  stopAudio: () => void;
  speak: () => Promise<void>;
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
  const [health, setHealth] = useState<HealthState>({ kind: "idle" });
  const [voices, setVoices] = useState<VoiceId[]>([]);
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tts, setTts] = useState<TtsState>({ kind: "idle" });
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const audioHandleRef = useRef<AudioHandle | null>(null);

  const client = useMemo(() => new TTSClient(serverUrl), [serverUrl]);

  const checkHealth = useCallback(async () => {
    setHealth({ kind: "checking" });
    const result = await client.listVoices();
    result.match(
      (list) => {
        setVoices(list);
        setVoice((prev) => pickVoice(prev)(list));
        setHealth(toHealthOk(list));
      },
      (err) => {
        setVoices([]);
        setHealth(toHealthFail(err.message));
      },
    );
  }, [client]);

  const onCheckSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void checkHealth();
    },
    [checkHealth],
  );

  const stopAudio = useCallback(() => {
    if (audioHandleRef.current) {
      disposeAudio(audioHandleRef.current);
      audioHandleRef.current = null;
    }
    setAudioElement(null);
    setTts((prev) => (prev.kind === "speaking" ? { kind: "idle" } : prev));
  }, []);

  const speak = useCallback(async () => {
    stopAudio();
    setTts({ kind: "speaking" });
    const result = await client.synthesize(text, { voice, speed });
    result.match(
      (buffer) => {
        const handle = buildAudio(buffer);
        audioHandleRef.current = handle;
        setAudioElement(handle.audio);
        handle.audio.onended = () => {
          disposeAudio(handle);
          if (audioHandleRef.current === handle) audioHandleRef.current = null;
          setAudioElement(null);
          setTts({ kind: "idle" });
        };
        handle.audio.onerror = () => {
          disposeAudio(handle);
          setAudioElement(null);
          setTts(toTtsError("Audio playback failed"));
        };
        void handle.audio.play();
      },
      (err) => setTts(toTtsError(err.message)),
    );
  }, [client, text, voice, speed, stopAudio]);

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
      text,
      setText,
      tts,
      audioElement,
      checkHealth,
      onCheckSubmit,
      stopAudio,
      speak,
    }),
    [
      serverUrl,
      health,
      voices,
      voice,
      speed,
      text,
      tts,
      audioElement,
      checkHealth,
      onCheckSubmit,
      stopAudio,
      speak,
    ],
  );

  return (
    <VoiceStoreContext.Provider value={value}>
      {children}
    </VoiceStoreContext.Provider>
  );
}
