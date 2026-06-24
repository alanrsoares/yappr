import { Effect } from "effect";
import { useInput } from "ink";
import { useCallback, useMemo, useState } from "react";

import { wantsBackKey } from "~/constants.js";
import {
  type ExtendedKey,
  getEffectiveKey,
  type InkKeyWithAlt,
  usePreferences,
  useQuery,
} from "~/hooks/index.js";
import { filterBySubstring } from "~/list-filter.js";
import { clampSelectedIndex, cycleIndex } from "~/list-nav.js";
import { quit } from "~/quit.js";
import { listVoices, speak } from "~/services/yappr";

const VOICE_PREVIEW_SAMPLE =
  "Hello. This is a short preview of the selected voice.";

export interface VoicesStoreInitialState {
  onBack: () => void;
}

export type VoicePreviewStatus = "idle" | "loading" | "ok" | "error";

/**
 * Voices screen controller. Single-consumer (the screen) — a plain hook, no
 * store/context needed. `useInput` drives filter + selection + preview.
 */
export function useVoicesController(initialState?: VoicesStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const { data: voices = [], error, isLoading } = useQuery(listVoices);
  const { preferences } = usePreferences();
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phraseCustom, setPhraseCustom] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [previewStatus, setPreviewStatus] =
    useState<VoicePreviewStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterBySubstring(voices, filterText, (v) => v),
    [voices, filterText],
  );
  const len = filtered.length;
  const effectiveIndex = useMemo(
    () => clampSelectedIndex(selectedIndex, len),
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
      void Effect.runPromise(
        speak(t, {
          voice: selectedVoice,
          ...(preferences.voiceReference
            ? { reference: preferences.voiceReference }
            : {}),
        }),
      ).then(
        () => {
          setPreviewStatus("ok");
          setPreviewError(null);
        },
        (e: unknown) => {
          setPreviewStatus("error");
          setPreviewError(e instanceof Error ? e.message : String(e));
        },
      );
    },
    [selectedVoice, preferences.voiceReference],
  );

  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);

    // Quit keys include "escape"; handle back before quit so Esc leaves the screen, not the app.
    if (wantsBackKey(effectiveKey)) {
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
      !(key as InkKeyWithAlt).alt &&
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
      !(key as InkKeyWithAlt).alt &&
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
      setSelectedIndex(cycleIndex(effectiveIndex, len, -1));
      return;
    }
    if ((effectiveKey === "downArrow" || effectiveKey === "j") && len > 0) {
      setSelectedIndex(cycleIndex(effectiveIndex, len, 1));
      return;
    }

    switch (effectiveKey) {
      case "ctrl+e":
        if (phraseCustom) {
          setPhraseCustom(false);
        } else {
          setPhrase((p) => (p.trim() ? p : VOICE_PREVIEW_SAMPLE));
          setPhraseCustom(true);
        }
        return;
      case "ctrl+p":
        playPreview(VOICE_PREVIEW_SAMPLE);
        return;
      case "return":
      case "enter":
      case "ctrl+s":
        if (phraseCustom) {
          playPreview(phrase.trim() || VOICE_PREVIEW_SAMPLE);
        } else {
          playPreview(VOICE_PREVIEW_SAMPLE);
        }
        break;
    }
  });

  return {
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
}
