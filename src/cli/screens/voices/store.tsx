import { useCallback, useMemo, useState } from "react";
import { useInput } from "ink";

import { DEFAULT_KEYS } from "~/cli/constants.js";
import {
  getEffectiveKey,
  useQuery,
  type ExtendedKey,
} from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import { listVoices, speak } from "~/cli/services/yappr";
import { createContainer } from "~/lib/unstated.js";

const VOICE_PREVIEW_SAMPLE =
  "Hello. This is a short preview of the selected voice.";

function filterVoiceIds(voices: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...voices];
  return voices.filter((v) => v.toLowerCase().includes(q));
}

const cycle = (i: number, n: number, d: number) =>
  n <= 0 ? 0 : (i + n + d) % n;

export interface VoicesStoreInitialState {
  onBack: () => void;
}

export type VoicePreviewStatus = "idle" | "loading" | "ok" | "error";

function useVoicesStoreLogic(initialState?: VoicesStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const { data: voices = [], error, isLoading } = useQuery(listVoices);
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phraseCustom, setPhraseCustom] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [previewStatus, setPreviewStatus] =
    useState<VoicePreviewStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterVoiceIds(voices, filterText),
    [voices, filterText],
  );
  const len = filtered.length;
  const effectiveIndex = useMemo(
    () => (len <= 0 ? 0 : Math.min(Math.max(0, selectedIndex), len - 1)),
    [len, selectedIndex],
  );
  const selectedVoice = len > 0 ? filtered[effectiveIndex] : null;

  const playPreview = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!selectedVoice) {
        setPreviewStatus("error");
        setPreviewError("No voice in the filtered list.");
        return;
      }
      if (!t) {
        setPreviewStatus("error");
        setPreviewError("Add some text to preview.");
        return;
      }
      setPreviewStatus("loading");
      setPreviewError(null);
      void speak(t, { voice: selectedVoice }).match(
        () => {
          setPreviewStatus("ok");
          setPreviewError(null);
        },
        (e) => {
          setPreviewStatus("error");
          setPreviewError(e.message);
        },
      );
    },
    [selectedVoice],
  );

  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);

    // `DEFAULT_KEYS.quit` includes "escape"; handle back before quit so Esc leaves the screen, not the app.
    const wantsBack =
      effectiveKey === "escape" ||
      (DEFAULT_KEYS.back as readonly string[]).includes(effectiveKey);
    if (wantsBack) {
      if (phraseCustom) {
        setPhraseCustom(false);
      } else {
        onBack();
      }
      return;
    }

    if (effectiveKey === "q" || effectiveKey === "ctrl+q") {
      quit();
      return;
    }

    if (isLoading || error) return;

    if (
      !phraseCustom &&
      !key.ctrl &&
      !key.meta &&
      !(key as { alt?: boolean }).alt &&
      !key.return
    ) {
      if (key.backspace) {
        setFilterText((x) => x.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      if (input.length === 1) {
        setFilterText((x) => x + input);
        setSelectedIndex(0);
        return;
      }
    }

    if (
      phraseCustom &&
      !key.ctrl &&
      !key.meta &&
      !(key as { alt?: boolean }).alt &&
      !key.return
    ) {
      if (key.backspace) {
        setPhrase((p) => p.slice(0, -1));
        return;
      }
      if (input.length === 1) {
        setPhrase((p) => p + input);
        return;
      }
    }

    if ((effectiveKey === "upArrow" || effectiveKey === "k") && len > 0) {
      setSelectedIndex(cycle(effectiveIndex, len, -1));
      return;
    }
    if ((effectiveKey === "downArrow" || effectiveKey === "j") && len > 0) {
      setSelectedIndex(cycle(effectiveIndex, len, 1));
      return;
    }

    if (effectiveKey === "ctrl+e") {
      if (phraseCustom) {
        setPhraseCustom(false);
      } else {
        setPhrase((p) => (p.trim() ? p : VOICE_PREVIEW_SAMPLE));
        setPhraseCustom(true);
      }
      return;
    }

    if (effectiveKey === "ctrl+p") {
      playPreview(VOICE_PREVIEW_SAMPLE);
      return;
    }

    if (
      effectiveKey === "return" ||
      effectiveKey === "enter" ||
      effectiveKey === "ctrl+s"
    ) {
      if (phraseCustom) {
        playPreview(phrase.trim() || VOICE_PREVIEW_SAMPLE);
      } else {
        playPreview(VOICE_PREVIEW_SAMPLE);
      }
      return;
    }
  });

  const state = {
    voices,
    error,
    isLoading,
    filterText,
    phraseCustom,
    phrase,
    previewStatus,
    previewError,
    filtered,
    len,
    effectiveIndex,
  };

  const actions = {};

  return [state, actions] as const;
}

export const { useContainer: useVoicesStore, Provider: VoicesProvider } =
  createContainer<
    ReturnType<typeof useVoicesStoreLogic>,
    VoicesStoreInitialState
  >(useVoicesStoreLogic);
