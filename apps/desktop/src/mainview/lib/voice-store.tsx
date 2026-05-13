import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createContainer } from "@yappr/lib/unstated";

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
import { preferencesOptions, voicesOptions } from "~/lib/queries";
import { TTSClient, type VoiceId } from "~/services/yappr";
import type { HealthState, TtsState } from "~/types";

type VoiceStoreValue = {
  serverUrl: string;
  setServerUrl: (v: string) => void;
  health: HealthState;
  voices: VoiceId[];
  voice: VoiceId;
  setVoice: (v: VoiceId) => void;
  speed: number;
  setSpeed: (v: number) => void;
  /** MediaDevices `deviceId` to use as `getUserMedia` input. `null` = system
   *  default. Persisted across launches. */
  inputDeviceId: string | null;
  setInputDeviceId: (v: string | null) => void;
  tts: TtsState;
  /** Force a backend re-probe (delegates to TanStack Query refetch). */
  checkHealth: () => Promise<void>;
  stopAudio: () => void;
  /** Speak the given text; no-op on empty. */
  speak: (text: string) => Promise<void>;
  /** Send a recorded audio Blob to the STT endpoint. Resolves with transcript. */
  transcribe: (blob: Blob) => Promise<string>;
};

function useVoiceStoreLogic(): VoiceStoreValue {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(null);
  const [tts, setTts] = useState<TtsState>({ kind: "idle" });
  const audioHandleRef = useRef<AudioHandle | null>(null);

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
    if (typeof prefs.defaultInputDeviceId === "string") {
      setInputDeviceId(prefs.defaultInputDeviceId || null);
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
  const setInputDeviceIdPersist = useCallback(
    (next: string | null) => {
      setInputDeviceId(next);
      // Empty string represents "system default" on the wire; renderer
      // hydrates it back to `null`.
      persistPrefs.mutate({ defaultInputDeviceId: next ?? "" });
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

  return useMemo<VoiceStoreValue>(
    () => ({
      serverUrl,
      setServerUrl: setServerUrlPersist,
      health,
      voices,
      voice,
      setVoice: setVoicePersist,
      speed,
      setSpeed: setSpeedPersist,
      inputDeviceId,
      setInputDeviceId: setInputDeviceIdPersist,
      tts,
      checkHealth,
      stopAudio,
      speak,
      transcribe,
    }),
    [
      serverUrl,
      setServerUrlPersist,
      health,
      voices,
      voice,
      setVoicePersist,
      speed,
      setSpeedPersist,
      inputDeviceId,
      setInputDeviceIdPersist,
      tts,
      checkHealth,
      stopAudio,
      speak,
      transcribe,
    ],
  );
}

export const { useContainer: useVoiceStore, Provider: VoiceStoreProvider } =
  createContainer<VoiceStoreValue>(useVoiceStoreLogic);
