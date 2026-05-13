import { useCallback, useMemo, useState } from "react";
import { useInput } from "ink";

import { createContainer } from "@yappr/lib/unstated";

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
  | "narrationModel"
  | null;

const PROVIDER_LABELS = ["Ollama", "OpenRouter"] as const;
const PROVIDER_VALUES = ["ollama", "openrouter"] as const;
type ProviderValue = (typeof PROVIDER_VALUES)[number];

type PickerKindNonNull = Exclude<PickerKind, null>;

export type SettingsTextEditor =
  | "ollamaUrl"
  | "mcpPath"
  | "chatModel"
  | "openrouterKey";

export interface SettingsTextEditorSession {
  field: SettingsTextEditor;
  value: string;
}

/** Indices aligned with `SettingsMainList` row order. */
export const SETTINGS_LIST_ROW = {
  chatProvider: 0,
  chatModel: 1,
  defaultVoice: 2,
  inputDevice: 3,
  outputDevice: 4,
  useNarrationForTts: 5,
  narrationModel: 6,
  ollamaUrl: 7,
  openrouterApiKey: 8,
  mcpConfigPath: 9,
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
  savePreferences: (next: Partial<Preferences>) => void,
) {
  const v = session.value.trim();
  switch (session.field) {
    case "ollamaUrl":
      savePreferences({ ollamaBaseUrl: v || "http://localhost:11434" });
      break;
    case "mcpPath":
      if (v) savePreferences({ mcpConfigPath: v });
      break;
    case "chatModel":
      if (v) savePreferences({ defaultChatModel: v });
      break;
    case "openrouterKey":
      savePreferences({ openrouterApiKey: v });
      break;
  }
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
    narrationModel: () => {
      const raw = selected as string;
      savePreferences({
        narrationModel: raw === "(same as chat)" ? "" : raw,
      });
    },
  };
  handlers[kind]();
}

function useSettingsStoreLogic(initialState?: SettingsStoreInitialState) {
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

  const narrationModelList = useMemo(
    () => ["(same as chat)", ...ollamaModels],
    [ollamaModels],
  );
  const pickerList = useMemo((): readonly PickerListItem[] | null => {
    if (!picker) return null;
    const lists: PickerListsByKind = {
      provider: [...PROVIDER_LABELS],
      model: ollamaModels,
      openRouterModel: openRouterModels,
      voice: voices,
      input: inputDevices,
      output: outputDevices,
      narrationModel: narrationModelList,
    };
    return lists[picker];
  }, [
    picker,
    ollamaModels,
    openRouterModels,
    voices,
    inputDevices,
    outputDevices,
    narrationModelList,
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
      case R.chatProvider:
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
      case R.chatModel: {
        if (preferences.defaultChatProvider === "openrouter") {
          if (openRouterModels.length > 0) {
            const idx = openRouterModels.findIndex(
              (m) => m.id === preferences.defaultChatModel,
            );
            const i = idx >= 0 ? idx : 0;
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
      case R.narrationModel: {
        const narrIdx = preferences.narrationModel
          ? Math.max(0, ollamaModels.indexOf(preferences.narrationModel) + 1)
          : 0;
        beginList("narrationModel", narrIdx, narrationModelList.length);
        break;
      }
      case R.ollamaUrl:
        setTextEditorSession({
          field: "ollamaUrl",
          value: preferences.ollamaBaseUrl,
        });
        break;
      case R.openrouterApiKey:
        setTextEditorSession({
          field: "openrouterKey",
          value: preferences.openrouterApiKey,
        });
        break;
      case R.mcpConfigPath:
        setTextEditorSession({
          field: "mcpPath",
          value: preferences.mcpConfigPath,
        });
        break;
    }
  }, [
    selectedRow,
    preferences.defaultChatProvider,
    preferences.defaultChatModel,
    preferences.defaultVoice,
    preferences.defaultInputDeviceIndex,
    preferences.defaultOutputDeviceIndex,
    preferences.narrationModel,
    preferences.ollamaBaseUrl,
    preferences.mcpConfigPath,
    preferences.openrouterApiKey,
    ollamaModels,
    openRouterModels,
    voices,
    inputDevices,
    outputDevices,
    narrationModelList,
  ]);

  const setTextEditorValue = useCallback((value: string) => {
    setTextEditorSession((s) => (s ? { ...s, value } : null));
  }, []);

  const confirmTextEditor = useCallback(() => {
    setTextEditorSession((s) => {
      if (s) commitTextEditorSession(s, savePreferences);
      return null;
    });
  }, [savePreferences]);

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
      if (selectedRow === SETTINGS_LIST_ROW.useNarrationForTts) {
        savePreferences({
          useNarrationForTTS: !preferences.useNarrationForTTS,
        });
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

export const { useContainer: useSettingsStore, Provider: SettingsProvider } =
  createContainer<
    ReturnType<typeof useSettingsStoreLogic>,
    SettingsStoreInitialState
  >(useSettingsStoreLogic);
