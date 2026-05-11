import { useCallback, useMemo, useState } from "react";
import { useInput } from "ink";

import { DEFAULT_KEYS } from "~/cli/constants.js";
import {
  getEffectiveKey,
  usePreferences,
  useQuery,
  type ExtendedKey,
} from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import {
  listInputDevices,
  listOllamaModels,
  listOpenRouterModels,
  listOutputDevices,
  listVoices,
} from "~/cli/services/yappr";
import type { ChatProvider } from "~/cli/types.js";
import { createContainer } from "~/lib/unstated.js";

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

export interface SettingsStoreInitialState {
  onBack: () => void;
}

const ROW_COUNT = 10;
const VISIBLE_PICKER_ROWS = 10;

const cycle = (i: number, n: number, d: number) =>
  n <= 0 ? 0 : (i + n + d) % n;

function clampPickerScrollOffset(index: number, listLength: number): number {
  return Math.max(
    0,
    Math.min(index, Math.max(0, listLength - VISIBLE_PICKER_ROWS)),
  );
}

/** Row value in any settings picker list (provider strings, Ollama ids, HF-style models, devices). */
export type PickerListItem =
  | string
  | { name?: string; id?: string; index?: number };

export const CHAT_PROVIDER_LABEL: Record<ChatProvider, string> = {
  ollama: PROVIDER_LABELS[0],
  openrouter: PROVIDER_LABELS[1],
};

export function pickerItemLabel(item: PickerListItem): string {
  if (typeof item === "string") return item;
  const name = item.name ?? "";
  const id = item.id ?? "";
  return id ? `${id} ${name}`.trim() : name;
}

function filterPickerList(
  list: readonly PickerListItem[] | null,
  query: string,
): PickerListItem[] {
  if (!list?.length) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((item) => pickerItemLabel(item).toLowerCase().includes(q));
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
      !!preferences.openrouterApiKey?.trim(),
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
  const [editingOllamaUrl, setEditingOllamaUrl] = useState(false);
  const [ollamaUrlInputValue, setOllamaUrlInputValue] = useState("");
  const [editingMcpConfigPath, setEditingMcpConfigPath] = useState(false);
  const [mcpConfigPathInputValue, setMcpConfigPathInputValue] = useState("");
  const [editingChatModel, setEditingChatModel] = useState(false);
  const [chatModelInputValue, setChatModelInputValue] = useState("");
  const [editingOpenrouterApiKey, setEditingOpenrouterApiKey] = useState(false);
  const [openrouterApiKeyInputValue, setOpenrouterApiKeyInputValue] =
    useState("");

  const narrationModelList = useMemo(
    () => ["(same as chat)", ...ollamaModels],
    [ollamaModels],
  );
  const pickerList = useMemo((): readonly PickerListItem[] | null => {
    if (!picker) return null;
    const lists: Record<
      Exclude<PickerKind, null>,
      readonly PickerListItem[]
    > = {
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

  const effectivePickerIndex =
    pickerLen <= 0 ? 0 : Math.min(Math.max(0, pickerIndex), pickerLen - 1);

  const visiblePickerStart = Math.max(
    0,
    Math.min(pickerScrollOffset, Math.max(0, pickerLen - VISIBLE_PICKER_ROWS)),
  );
  const visiblePickerSlice = useMemo(
    () =>
      filteredPickerList.slice(
        visiblePickerStart,
        visiblePickerStart + VISIBLE_PICKER_ROWS,
      ),
    [filteredPickerList, visiblePickerStart],
  );

  const inputDeviceLabel =
    inputDevices.find((d) => d.index === preferences.defaultInputDeviceIndex)
      ?.name ?? `Device ${preferences.defaultInputDeviceIndex}`;
  const outputDeviceLabel =
    outputDevices.find((d) => d.index === preferences.defaultOutputDeviceIndex)
      ?.name ?? `Device ${preferences.defaultOutputDeviceIndex}`;

  const openPicker = useCallback(() => {
    const beginList = (
      kind: Exclude<PickerKind, null>,
      index: number,
      listLength: number,
      scroll: "clamp" | "zero" = "clamp",
    ) => {
      setPicker(kind);
      setPickerFilterText("");
      setPickerIndex(index);
      setPickerScrollOffset(
        scroll === "zero" ? 0 : clampPickerScrollOffset(index, listLength),
      );
    };

    switch (selectedRow) {
      case 0:
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
      case 1: {
        if (preferences.defaultChatProvider === "openrouter") {
          if (openRouterModels.length > 0) {
            const idx = openRouterModels.findIndex(
              (m) => m.id === preferences.defaultChatModel,
            );
            const i = idx >= 0 ? idx : 0;
            beginList("openRouterModel", i, openRouterModels.length);
          } else {
            setEditingChatModel(true);
            setChatModelInputValue(preferences.defaultChatModel);
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
      case 2: {
        const voiceIdx = Math.max(0, voices.indexOf(preferences.defaultVoice));
        beginList("voice", voiceIdx, voices.length);
        break;
      }
      case 3: {
        const inputIdx = Math.max(
          0,
          inputDevices.findIndex(
            (d) => d.index === preferences.defaultInputDeviceIndex,
          ),
        );
        beginList("input", inputIdx, inputDevices.length);
        break;
      }
      case 4: {
        const outputIdx = Math.max(
          0,
          outputDevices.findIndex(
            (d) => d.index === preferences.defaultOutputDeviceIndex,
          ),
        );
        beginList("output", outputIdx, outputDevices.length);
        break;
      }
      case 6: {
        const narrIdx = preferences.narrationModel
          ? Math.max(0, ollamaModels.indexOf(preferences.narrationModel) + 1)
          : 0;
        beginList("narrationModel", narrIdx, narrationModelList.length);
        break;
      }
      case 7:
        setEditingOllamaUrl(true);
        setOllamaUrlInputValue(preferences.ollamaBaseUrl);
        break;
      case 8:
        setEditingOpenrouterApiKey(true);
        setOpenrouterApiKeyInputValue(preferences.openrouterApiKey);
        break;
      case 9:
        setEditingMcpConfigPath(true);
        setMcpConfigPathInputValue(preferences.mcpConfigPath);
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

  const confirmOllamaUrlEdit = useCallback(() => {
    const url = ollamaUrlInputValue.trim() || "http://localhost:11434";
    savePreferences({ ollamaBaseUrl: url });
    setEditingOllamaUrl(false);
  }, [ollamaUrlInputValue, savePreferences]);

  const cancelOllamaUrlEdit = useCallback(() => {
    setEditingOllamaUrl(false);
  }, []);

  const confirmMcpConfigPathEdit = useCallback(() => {
    const path = mcpConfigPathInputValue.trim();
    if (path) savePreferences({ mcpConfigPath: path });
    setEditingMcpConfigPath(false);
  }, [mcpConfigPathInputValue, savePreferences]);

  const cancelMcpConfigPathEdit = useCallback(() => {
    setEditingMcpConfigPath(false);
  }, []);

  const confirmChatModelEdit = useCallback(() => {
    const value = chatModelInputValue.trim();
    if (value) savePreferences({ defaultChatModel: value });
    setEditingChatModel(false);
  }, [chatModelInputValue, savePreferences]);

  const cancelChatModelEdit = useCallback(() => {
    setEditingChatModel(false);
  }, []);

  const confirmOpenrouterApiKeyEdit = useCallback(() => {
    savePreferences({ openrouterApiKey: openrouterApiKeyInputValue.trim() });
    setEditingOpenrouterApiKey(false);
  }, [openrouterApiKeyInputValue, savePreferences]);

  const cancelOpenrouterApiKeyEdit = useCallback(() => {
    setEditingOpenrouterApiKey(false);
  }, []);

  const confirmPicker = useCallback(() => {
    const selected = filteredPickerList[effectivePickerIndex];
    if (selected === undefined) {
      setPicker(null);
      setPickerFilterText("");
      return;
    }
    switch (picker) {
      case "provider":
        if (PROVIDER_VALUES[effectivePickerIndex]) {
          savePreferences({
            defaultChatProvider: PROVIDER_VALUES[
              effectivePickerIndex
            ] as ProviderValue,
          });
        }
        break;
      case "model":
        savePreferences({ defaultChatModel: selected as string });
        break;
      case "openRouterModel":
        savePreferences({
          defaultChatModel: (selected as { id: string }).id,
        });
        break;
      case "voice":
        savePreferences({ defaultVoice: selected as string });
        break;
      case "input":
        savePreferences({
          defaultInputDeviceIndex: (selected as { index: number }).index,
        });
        break;
      case "output":
        savePreferences({
          defaultOutputDeviceIndex: (selected as { index: number }).index,
        });
        break;
      case "narrationModel": {
        const raw = selected as string;
        savePreferences({
          narrationModel: raw === "(same as chat)" ? "" : raw,
        });
        break;
      }
    }
    setPicker(null);
    setPickerFilterText("");
  }, [picker, effectivePickerIndex, filteredPickerList, savePreferences]);

  const closePicker = useCallback(() => {
    setPicker(null);
    setPickerFilterText("");
  }, []);

  const isEditing =
    editingOllamaUrl ||
    editingMcpConfigPath ||
    editingChatModel ||
    editingOpenrouterApiKey;

  const movePickerSelection = useCallback(
    (delta: number) => {
      const next = cycle(effectivePickerIndex, pickerLen, delta);
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
      !(key as { alt?: boolean }).alt &&
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
    if ((effectiveKey === "upArrow" || effectiveKey === "k") && !isEditing) {
      if (picker) movePickerSelection(-1);
      else setSelectedRow((r) => cycle(r, ROW_COUNT, -1));
      return;
    }
    if ((effectiveKey === "downArrow" || effectiveKey === "j") && !isEditing) {
      if (picker) movePickerSelection(1);
      else setSelectedRow((r) => cycle(r, ROW_COUNT, 1));
      return;
    }
    if (
      effectiveKey === "return" ||
      effectiveKey === "enter" ||
      effectiveKey === "ctrl+s"
    ) {
      if (editingOllamaUrl) confirmOllamaUrlEdit();
      else if (editingMcpConfigPath) confirmMcpConfigPathEdit();
      else if (editingChatModel) confirmChatModelEdit();
      else if (editingOpenrouterApiKey) confirmOpenrouterApiKeyEdit();
      else if (picker) confirmPicker();
      else if (selectedRow === 5)
        savePreferences({
          useNarrationForTTS: !preferences.useNarrationForTTS,
        });
      else openPicker();
      return;
    }
    const wantsBack =
      effectiveKey === "escape" ||
      (DEFAULT_KEYS.back as readonly string[]).includes(effectiveKey);
    if (wantsBack) {
      if (editingOllamaUrl) cancelOllamaUrlEdit();
      else if (editingMcpConfigPath) cancelMcpConfigPathEdit();
      else if (editingChatModel) cancelChatModelEdit();
      else if (editingOpenrouterApiKey) cancelOpenrouterApiKeyEdit();
      else if (picker) closePicker();
      else onBack();
      return;
    }
    if (
      (DEFAULT_KEYS.quit as readonly string[]).includes(effectiveKey) ||
      effectiveKey === "ctrl+q"
    )
      quit();
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
    editingOllamaUrl,
    ollamaUrlInputValue,
    editingMcpConfigPath,
    mcpConfigPathInputValue,
    editingChatModel,
    chatModelInputValue,
    editingOpenrouterApiKey,
    openrouterApiKeyInputValue,
  };

  const actions = {
    onBack,
    setOllamaUrlInputValue,
    confirmOllamaUrlEdit,
    cancelOllamaUrlEdit,
    setMcpConfigPathInputValue,
    confirmMcpConfigPathEdit,
    cancelMcpConfigPathEdit,
    setChatModelInputValue,
    confirmChatModelEdit,
    cancelChatModelEdit,
    setOpenrouterApiKeyInputValue,
    confirmOpenrouterApiKeyEdit,
    cancelOpenrouterApiKeyEdit,
  };

  return [state, actions] as const;
}

export const { useContainer: useSettingsStore, Provider: SettingsProvider } =
  createContainer<
    ReturnType<typeof useSettingsStoreLogic>,
    SettingsStoreInitialState
  >(useSettingsStoreLogic);
