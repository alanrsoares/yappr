import { useCallback, useMemo, useState } from "react";
import { useInput } from "ink";

import { DEFAULT_SERVER_URL } from "@yappr/sdk/defaults";
import { probeHealth, type HealthSnapshot } from "@yappr/sdk/health";
import { VoiceConfigSchema, type VoiceConfig } from "@yappr/sdk/schemas";
import {
  buildSpeechPreset,
  type SpeechPresetKind,
} from "@yappr/sdk/speech-presets";
import { VOXTRAL_DEFAULT_VOICE } from "@yappr/sdk/voxtral-voices";

import { wantsBackKey } from "~/constants.js";
import {
  getEffectiveKey,
  usePreferences,
  useQuery,
  type ExtendedKey,
  type InkKeyWithAlt,
} from "~/hooks/index.js";
import { filterBySubstring } from "~/list-filter.js";
import { clampSelectedIndex, cycleIndex } from "~/list-nav.js";
import { quit } from "~/quit.js";
import {
  listInputDevices,
  listOllamaModels,
  listOpenRouterModels,
  listOutputDevices,
  listVoices,
} from "~/services/yappr";
import type { ChatProvider, Preferences } from "~/types.js";

export type PickerKind =
  | "provider"
  | "model"
  | "openRouterModel"
  | "voice"
  | "input"
  | "output"
  | "speechEndpoint"
  | null;

const PROVIDER_LABELS = ["Ollama", "OpenRouter"] as const;
const PROVIDER_VALUES = ["ollama", "openrouter"] as const;
type ProviderValue = (typeof PROVIDER_VALUES)[number];

/** Speech endpoint preset rows surfaced in the settings picker. */
const SPEECH_ENDPOINT_LABELS = [
  "Yappr local (Kokoro / Whisper via Python sidecar)",
  "Voxtral remote (vllm-omni at localhost:8000/v1)",
  "OpenAI-compatible (manual edit required)",
] as const;

const SPEECH_ENDPOINT_VALUES: readonly SpeechPresetKind[] = [
  "yappr",
  "voxtral",
  "custom",
] as const;

type SpeechEndpointPreset = SpeechPresetKind;

function applySpeechPreset(kind: SpeechPresetKind): {
  voice: VoiceConfig;
  defaultVoice?: string;
} {
  return {
    voice: VoiceConfigSchema.parse({
      speech: buildSpeechPreset(kind),
      transcription: { kind: "yappr", baseUrl: DEFAULT_SERVER_URL },
    }),
    ...(kind === "voxtral" ? { defaultVoice: VOXTRAL_DEFAULT_VOICE } : {}),
  };
}

type PickerKindNonNull = Exclude<PickerKind, null>;

export type SettingsTextEditor =
  | "ollamaUrl"
  | "mcpPath"
  | "chatModel"
  | "openrouterKey"
  | "voiceReferenceAudio"
  | "voiceReferenceTranscript";

export interface SettingsTextEditorSession {
  field: SettingsTextEditor;
  value: string;
}

/** Indices aligned with `SettingsMainList` row order. */
export const SETTINGS_LIST_ROW = {
  chatProvider: 0,
  chatModel: 1,
  speechEndpoint: 2,
  defaultVoice: 3,
  inputDevice: 4,
  outputDevice: 5,
  voiceReferenceAudio: 6,
  voiceReferenceTranscript: 7,
  ollamaUrl: 8,
  openrouterApiKey: 9,
  mcpConfigPath: 10,
} as const;

export const SETTINGS_MAIN_LIST_ROW_COUNT =
  (Object.values(SETTINGS_LIST_ROW) as readonly number[]).reduce(
    (m, n) => Math.max(m, n),
    0,
  ) + 1;

/** Max visible rows in a settings picker window (independent of main list length). */
const VISIBLE_PICKER_ROWS = 10;

export interface PickerListItemRecord {
  name?: string;
  id?: string;
  index?: number;
}

export type PickerListItem = string | PickerListItemRecord;

export interface VisiblePickerWindow {
  visiblePickerStart: number;
  visiblePickerSlice: PickerListItem[];
}

export type PickerListsByKind = Record<
  PickerKindNonNull,
  readonly PickerListItem[]
>;

export type PickerOpenScrollMode = "clamp" | "zero";

export interface PickerOpenRouterRow {
  id: string;
}

export interface PickerDeviceRow {
  index: number;
}

function commitTextEditorSession(
  session: SettingsTextEditorSession,
  prefs: Preferences,
  savePreferences: (next: Partial<Preferences>) => void,
) {
  const v = session.value.trim();
  switch (session.field) {
    case "ollamaUrl": {
      savePreferences({ ollamaBaseUrl: v || "http://localhost:11434" });
      break;
    }
    case "mcpPath": {
      if (v) savePreferences({ mcpConfigPath: v });
      break;
    }
    case "chatModel": {
      if (v) savePreferences({ defaultChatModel: v });
      break;
    }
    case "openrouterKey": {
      savePreferences({ openrouterApiKey: v });
      break;
    }
    case "voiceReferenceAudio": {
      savePreferences({
        voiceReference: nextVoiceReference(prefs, { audio_path: v }),
      });
      break;
    }
    case "voiceReferenceTranscript": {
      savePreferences({
        voiceReference: nextVoiceReference(prefs, { transcript: v }),
      });
      break;
    }
  }
}

/** Update one half of the voice reference, dropping it entirely when both
 *  sides become empty. A reference with a blank path/transcript is useless to
 *  any cloning backend, so persisting a half-filled record helps no one. */
function nextVoiceReference(
  prefs: Preferences,
  patch: Partial<{ audio_path: string; transcript: string }>,
): Preferences["voiceReference"] {
  const audio_path = patch.audio_path ?? prefs.voiceReference?.audio_path ?? "";
  const transcript = patch.transcript ?? prefs.voiceReference?.transcript ?? "";
  if (!audio_path && !transcript) return null;
  return { audio_path, transcript };
}

export interface SettingsStoreInitialState {
  onBack: () => void;
}

function clampPickerScrollOffset(index: number, listLength: number): number {
  return Math.max(
    0,
    Math.min(index, Math.max(0, listLength - VISIBLE_PICKER_ROWS)),
  );
}

export const CHAT_PROVIDER_LABEL: Record<ChatProvider, string> = {
  ollama: PROVIDER_LABELS[0],
  openrouter: PROVIDER_LABELS[1],
};

export function pickerItemLabel(item: PickerListItem): string {
  if (typeof item === "string") return item;
  const row: PickerListItemRecord = item;
  const name = row.name ?? "";
  const id = row.id ?? "";
  return id ? `${id} ${name}`.trim() : name;
}

function filterPickerList(
  list: readonly PickerListItem[] | null,
  query: string,
): PickerListItem[] {
  if (!list?.length) return [];
  return filterBySubstring(list, query, pickerItemLabel);
}

function commitPickerChoice(
  kind: PickerKindNonNull,
  selected: PickerListItem,
  effectivePickerIndex: number,
  savePreferences: (next: Partial<Preferences>) => void,
) {
  const handlers: Record<PickerKindNonNull, () => void> = {
    provider: () => {
      if (PROVIDER_VALUES[effectivePickerIndex]) {
        savePreferences({
          defaultChatProvider: PROVIDER_VALUES[
            effectivePickerIndex
          ] as ProviderValue,
        });
      }
    },
    model: () => savePreferences({ defaultChatModel: selected as string }),
    openRouterModel: () =>
      savePreferences({
        defaultChatModel: (selected as PickerOpenRouterRow).id,
      }),
    voice: () => savePreferences({ defaultVoice: selected as string }),
    input: () =>
      savePreferences({
        defaultInputDeviceIndex: (selected as PickerDeviceRow).index,
      }),
    output: () =>
      savePreferences({
        defaultOutputDeviceIndex: (selected as PickerDeviceRow).index,
      }),
    speechEndpoint: () => {
      const preset = SPEECH_ENDPOINT_VALUES[effectivePickerIndex];
      if (!preset) return;
      const next = applySpeechPreset(preset);
      savePreferences({
        voice: next.voice,
        ...(next.defaultVoice ? { defaultVoice: next.defaultVoice } : {}),
      });
    },
  };
  handlers[kind]();
}

/**
 * Settings screen controller. The screen renders its child views mutually
 * exclusively (edit-layer XOR picker-panel XOR main-list), so there's no
 * concurrent shared state — a plain hook owned by the screen, passed down as
 * props. No store/context needed.
 */
export function useSettingsController(
  initialState?: SettingsStoreInitialState,
) {
  const onBack = initialState?.onBack ?? (() => {});

  const { preferences, savePreferences } = usePreferences();
  const {
    data: ollamaModels = [],
    isLoading: modelsLoading,
    error: ollamaModelsError,
  } = useQuery(() => listOllamaModels(preferences.ollamaBaseUrl), {
    deps: [preferences.ollamaBaseUrl],
  });
  const {
    data: openRouterModels = [],
    isLoading: openRouterModelsLoading,
    error: openRouterModelsError,
  } = useQuery(() => listOpenRouterModels(preferences.openrouterApiKey), {
    deps: [preferences.openrouterApiKey],
    enabled:
      preferences.defaultChatProvider === "openrouter" &&
      Boolean(preferences.openrouterApiKey?.trim()),
  });
  const { data: voices = [] } = useQuery(listVoices);
  const { data: engineHealth } = useQuery<HealthSnapshot, Error>(
    () =>
      probeHealth(
        preferences.voice.speech.kind === "yappr"
          ? preferences.voice.speech.baseUrl
          : DEFAULT_SERVER_URL,
      ),
    { deps: [preferences.voice.speech] },
  );
  const { data: inputDevices = [], isLoading: inputDevicesLoading } =
    useQuery(listInputDevices);
  const { data: outputDevices = [], isLoading: outputDevicesLoading } =
    useQuery(listOutputDevices);

  const [selectedRow, setSelectedRow] = useState(0);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [pickerFilterText, setPickerFilterText] = useState("");
  const [pickerScrollOffset, setPickerScrollOffset] = useState(0);
  const [textEditorSession, setTextEditorSession] =
    useState<SettingsTextEditorSession | null>(null);

  const pickerList = useMemo((): readonly PickerListItem[] | null => {
    if (!picker) return null;
    const lists: PickerListsByKind = {
      provider: [...PROVIDER_LABELS],
      model: ollamaModels,
      openRouterModel: openRouterModels,
      voice: voices,
      input: inputDevices,
      output: outputDevices,
      speechEndpoint: [...SPEECH_ENDPOINT_LABELS],
    };
    return lists[picker];
  }, [
    picker,
    ollamaModels,
    openRouterModels,
    voices,
    inputDevices,
    outputDevices,
  ]);
  const filteredPickerList = useMemo(
    () => filterPickerList(pickerList, pickerFilterText),
    [pickerList, pickerFilterText],
  );
  const pickerLen = filteredPickerList.length;

  const effectivePickerIndex = clampSelectedIndex(pickerIndex, pickerLen);

  const { visiblePickerStart, visiblePickerSlice } =
    useMemo((): VisiblePickerWindow => {
      const start = Math.max(
        0,
        Math.min(
          pickerScrollOffset,
          Math.max(0, pickerLen - VISIBLE_PICKER_ROWS),
        ),
      );
      return {
        visiblePickerStart: start,
        visiblePickerSlice: filteredPickerList.slice(
          start,
          start + VISIBLE_PICKER_ROWS,
        ),
      };
    }, [filteredPickerList, pickerScrollOffset, pickerLen]);

  const inputDeviceLabel = useMemo(() => {
    const idx = preferences.defaultInputDeviceIndex;
    return inputDevices.find((d) => d.index === idx)?.name ?? `Device ${idx}`;
  }, [inputDevices, preferences.defaultInputDeviceIndex]);

  const outputDeviceLabel = useMemo(() => {
    const idx = preferences.defaultOutputDeviceIndex;
    return outputDevices.find((d) => d.index === idx)?.name ?? `Device ${idx}`;
  }, [outputDevices, preferences.defaultOutputDeviceIndex]);

  const speechModel =
    preferences.voice.speech.kind === "openai-compatible"
      ? preferences.voice.speech.model
      : undefined;

  const openPicker = useCallback(() => {
    const R = SETTINGS_LIST_ROW;
    const beginList = (
      kind: PickerKindNonNull,
      index: number,
      listLength: number,
      scroll: PickerOpenScrollMode = "clamp",
    ) => {
      setPicker(kind);
      setPickerFilterText("");
      setPickerIndex(index);
      setPickerScrollOffset(
        scroll === "zero" ? 0 : clampPickerScrollOffset(index, listLength),
      );
    };

    switch (selectedRow) {
      case R.chatProvider: {
        beginList(
          "provider",
          Math.max(
            0,
            PROVIDER_VALUES.indexOf(
              preferences.defaultChatProvider as ProviderValue,
            ),
          ),
          PROVIDER_VALUES.length,
          "zero",
        );
        break;
      }
      case R.chatModel: {
        if (preferences.defaultChatProvider === "openrouter") {
          if (openRouterModels.length > 0) {
            const idx = openRouterModels.findIndex(
              (m) => m.id === preferences.defaultChatModel,
            );
            const i = Math.max(idx, 0);
            beginList("openRouterModel", i, openRouterModels.length);
          } else {
            setTextEditorSession({
              field: "chatModel",
              value: preferences.defaultChatModel,
            });
          }
        } else {
          const i = Math.max(
            0,
            ollamaModels.indexOf(preferences.defaultChatModel),
          );
          beginList("model", i, ollamaModels.length);
        }
        break;
      }
      case R.speechEndpoint: {
        const currentKind: SpeechEndpointPreset =
          preferences.voice.speech.kind === "yappr"
            ? "yappr"
            : preferences.voice.speech.kind === "openai-compatible" &&
                speechModel === "mistralai/Voxtral-4B-TTS-2603"
              ? "voxtral"
              : "custom";
        const idx = Math.max(0, SPEECH_ENDPOINT_VALUES.indexOf(currentKind));
        beginList("speechEndpoint", idx, SPEECH_ENDPOINT_VALUES.length);
        break;
      }
      case R.defaultVoice: {
        const voiceIdx = Math.max(0, voices.indexOf(preferences.defaultVoice));
        beginList("voice", voiceIdx, voices.length);
        break;
      }
      case R.inputDevice: {
        const inputIdx = Math.max(
          0,
          inputDevices.findIndex(
            (d) => d.index === preferences.defaultInputDeviceIndex,
          ),
        );
        beginList("input", inputIdx, inputDevices.length);
        break;
      }
      case R.outputDevice: {
        const outputIdx = Math.max(
          0,
          outputDevices.findIndex(
            (d) => d.index === preferences.defaultOutputDeviceIndex,
          ),
        );
        beginList("output", outputIdx, outputDevices.length);
        break;
      }
      case R.voiceReferenceAudio: {
        setTextEditorSession({
          field: "voiceReferenceAudio",
          value: preferences.voiceReference?.audio_path ?? "",
        });
        break;
      }
      case R.voiceReferenceTranscript: {
        setTextEditorSession({
          field: "voiceReferenceTranscript",
          value: preferences.voiceReference?.transcript ?? "",
        });
        break;
      }
      case R.ollamaUrl: {
        setTextEditorSession({
          field: "ollamaUrl",
          value: preferences.ollamaBaseUrl,
        });
        break;
      }
      case R.openrouterApiKey: {
        setTextEditorSession({
          field: "openrouterKey",
          value: preferences.openrouterApiKey,
        });
        break;
      }
      case R.mcpConfigPath: {
        setTextEditorSession({
          field: "mcpPath",
          value: preferences.mcpConfigPath,
        });
        break;
      }
    }
  }, [
    selectedRow,
    preferences.defaultChatProvider,
    preferences.defaultChatModel,
    preferences.voice.speech.kind,
    speechModel,
    preferences.defaultVoice,
    preferences.defaultInputDeviceIndex,
    preferences.defaultOutputDeviceIndex,
    preferences.voiceReference?.audio_path,
    preferences.voiceReference?.transcript,
    preferences.ollamaBaseUrl,
    preferences.openrouterApiKey,
    preferences.mcpConfigPath,
    openRouterModels,
    ollamaModels,
    voices,
    inputDevices,
    outputDevices,
  ]);

  const setTextEditorValue = useCallback((value: string) => {
    setTextEditorSession((s) => (s ? { ...s, value } : null));
  }, []);

  const confirmTextEditor = useCallback(() => {
    setTextEditorSession((s) => {
      if (s) commitTextEditorSession(s, preferences, savePreferences);
      return null;
    });
  }, [preferences, savePreferences]);

  const cancelTextEditor = useCallback(() => {
    setTextEditorSession(null);
  }, []);

  const closePicker = useCallback(() => {
    setPicker(null);
    setPickerFilterText("");
  }, []);

  const confirmPicker = useCallback(() => {
    const selected = filteredPickerList[effectivePickerIndex];
    if (selected === undefined) {
      closePicker();
      return;
    }
    if (picker) {
      commitPickerChoice(
        picker,
        selected,
        effectivePickerIndex,
        savePreferences,
      );
    }
    closePicker();
  }, [
    picker,
    effectivePickerIndex,
    filteredPickerList,
    savePreferences,
    closePicker,
  ]);

  const isInlineTextEditing = textEditorSession !== null;

  const movePickerSelection = useCallback(
    (delta: number) => {
      const next = cycleIndex(effectivePickerIndex, pickerLen, delta);
      setPickerIndex(next);
      setPickerScrollOffset((s) => {
        const maxScroll = Math.max(0, pickerLen - VISIBLE_PICKER_ROWS);
        if (next < s) return Math.min(next, maxScroll);
        if (next >= s + VISIBLE_PICKER_ROWS)
          return Math.min(next - VISIBLE_PICKER_ROWS + 1, maxScroll);
        return s;
      });
    },
    [effectivePickerIndex, pickerLen],
  );

  useInput((input, key) => {
    if (
      picker &&
      !key.ctrl &&
      !key.meta &&
      !(key as InkKeyWithAlt).alt &&
      !key.return
    ) {
      if (key.backspace) {
        setPickerFilterText((t) => t.slice(0, -1));
        return;
      }
      if (input.length === 1) {
        setPickerFilterText((t) => t + input);
        return;
      }
    }
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);

    if (
      (effectiveKey === "upArrow" || effectiveKey === "k") &&
      !isInlineTextEditing
    ) {
      if (picker) movePickerSelection(-1);
      else
        setSelectedRow((r) => cycleIndex(r, SETTINGS_MAIN_LIST_ROW_COUNT, -1));
      return;
    }
    if (
      (effectiveKey === "downArrow" || effectiveKey === "j") &&
      !isInlineTextEditing
    ) {
      if (picker) movePickerSelection(1);
      else
        setSelectedRow((r) => cycleIndex(r, SETTINGS_MAIN_LIST_ROW_COUNT, 1));
      return;
    }
    if (
      effectiveKey === "return" ||
      effectiveKey === "enter" ||
      effectiveKey === "ctrl+s"
    ) {
      if (textEditorSession) {
        confirmTextEditor();
        return;
      }
      if (picker) {
        confirmPicker();
        return;
      }
      openPicker();
      return;
    }
    if (wantsBackKey(effectiveKey)) {
      if (textEditorSession) {
        cancelTextEditor();
        return;
      }
      if (picker) {
        closePicker();
        return;
      }
      onBack();
      return;
    }
    if (effectiveKey === "ctrl+q") {
      quit();
      return;
    }
    if (effectiveKey === "q" && !isInlineTextEditing) {
      quit();
    }
  });

  const state = {
    preferences,
    engineHealth,
    modelsLoading,
    ollamaModelsError,
    openRouterModelsLoading,
    openRouterModelsError,
    inputDevicesLoading,
    outputDevicesLoading,
    selectedRow,
    picker,
    effectivePickerIndex,
    pickerFilterText,
    visiblePickerSlice,
    visiblePickerStart,
    pickerLen,
    visiblePickerRows: VISIBLE_PICKER_ROWS,
    inputDeviceLabel,
    outputDeviceLabel,
    textEditorSession,
  };

  const actions = {
    onBack,
    setTextEditorValue,
    confirmTextEditor,
    cancelTextEditor,
  };

  return [state, actions] as const;
}

export type SettingsState = ReturnType<typeof useSettingsController>[0];
export type SettingsActions = ReturnType<typeof useSettingsController>[1];
