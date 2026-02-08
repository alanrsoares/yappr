import { useCallback, useMemo, useState } from "react";
import { useInput } from "ink";

import { DEFAULT_KEYS } from "~/cli/constants.js";
import { usePreferences, useQuery } from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import {
  listInputDevices,
  listOllamaModels,
  listOpenRouterModels,
  listOutputDevices,
  listVoices,
} from "~/cli/services/yappr.js";
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

function pickerItemLabel(
  item: string | { name?: string; id?: string },
): string {
  if (typeof item === "string") return item;
  const name = item.name ?? "";
  const id = item.id ?? "";
  return id ? `${id} ${name}`.trim() : name;
}

function filterPickerList(list: unknown[] | null, query: string): unknown[] {
  if (!list?.length) return [];
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) =>
    pickerItemLabel(item as string | { name?: string; id?: string })
      .toLowerCase()
      .includes(q),
  );
}

function useSettingsStoreLogic(initialState?: SettingsStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const { preferences, savePreferences } = usePreferences();
  const { data: ollamaModels = [], isLoading: modelsLoading } = useQuery(
    () => listOllamaModels(preferences.ollamaBaseUrl),
    { deps: [preferences.ollamaBaseUrl] },
  );
  const { data: openRouterModels = [], isLoading: openRouterModelsLoading } =
    useQuery(() => listOpenRouterModels(preferences.openrouterApiKey), {
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
  const pickerList = picker
    ? {
        provider: PROVIDER_LABELS as unknown as string[],
        model: ollamaModels,
        openRouterModel: openRouterModels,
        voice: voices,
        input: inputDevices,
        output: outputDevices,
        narrationModel: narrationModelList,
      }[picker]
    : null;
  const filteredPickerList = useMemo(
    () => filterPickerList(pickerList ?? [], pickerFilterText),
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
    switch (selectedRow) {
      case 0:
        setPicker("provider");
        setPickerFilterText("");
        setPickerScrollOffset(0);
        setPickerIndex(
          Math.max(
            0,
            PROVIDER_VALUES.indexOf(
              preferences.defaultChatProvider as ProviderValue,
            ),
          ),
        );
        break;
      case 1: {
        if (preferences.defaultChatProvider === "openrouter") {
          if (openRouterModels.length > 0) {
            setPicker("openRouterModel");
            setPickerFilterText("");
            const idx = openRouterModels.findIndex(
              (m) => m.id === preferences.defaultChatModel,
            );
            const i = idx >= 0 ? idx : 0;
            setPickerIndex(i);
            setPickerScrollOffset(
              Math.max(
                0,
                Math.min(i, openRouterModels.length - VISIBLE_PICKER_ROWS),
              ),
            );
          } else {
            setEditingChatModel(true);
            setChatModelInputValue(preferences.defaultChatModel);
          }
        } else {
          setPicker("model");
          setPickerFilterText("");
          const i = Math.max(
            0,
            ollamaModels.indexOf(preferences.defaultChatModel),
          );
          setPickerIndex(i);
          setPickerScrollOffset(
            Math.max(0, Math.min(i, ollamaModels.length - VISIBLE_PICKER_ROWS)),
          );
        }
        break;
      }
      case 2: {
        setPicker("voice");
        setPickerFilterText("");
        const voiceIdx = Math.max(0, voices.indexOf(preferences.defaultVoice));
        setPickerIndex(voiceIdx);
        setPickerScrollOffset(
          Math.max(0, Math.min(voiceIdx, voices.length - VISIBLE_PICKER_ROWS)),
        );
        break;
      }
      case 3: {
        setPicker("input");
        setPickerFilterText("");
        const inputIdx = Math.max(
          0,
          inputDevices.findIndex(
            (d) => d.index === preferences.defaultInputDeviceIndex,
          ),
        );
        setPickerIndex(inputIdx);
        setPickerScrollOffset(
          Math.max(
            0,
            Math.min(inputIdx, inputDevices.length - VISIBLE_PICKER_ROWS),
          ),
        );
        break;
      }
      case 4: {
        setPicker("output");
        setPickerFilterText("");
        const outputIdx = Math.max(
          0,
          outputDevices.findIndex(
            (d) => d.index === preferences.defaultOutputDeviceIndex,
          ),
        );
        setPickerIndex(outputIdx);
        setPickerScrollOffset(
          Math.max(
            0,
            Math.min(outputIdx, outputDevices.length - VISIBLE_PICKER_ROWS),
          ),
        );
        break;
      }
      case 6: {
        setPicker("narrationModel");
        setPickerFilterText("");
        const narrIdx = preferences.narrationModel
          ? Math.max(0, ollamaModels.indexOf(preferences.narrationModel) + 1)
          : 0;
        setPickerIndex(narrIdx);
        setPickerScrollOffset(
          Math.max(
            0,
            Math.min(narrIdx, narrationModelList.length - VISIBLE_PICKER_ROWS),
          ),
        );
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
      // case 5: narration toggle, no picker
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
    const effectiveKey = key.escape
      ? "escape"
      : key.return
        ? "return"
        : key.upArrow
          ? "upArrow"
          : key.downArrow
            ? "downArrow"
            : key.tab
              ? "tab"
              : key.backspace
                ? "backspace"
                : input && key.ctrl
                  ? `ctrl+${input.toLowerCase()}`
                  : input;
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
    if (effectiveKey === "return" || effectiveKey === "enter" || effectiveKey === "ctrl+s") {
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
    if (effectiveKey === "escape") {
      if (editingOllamaUrl) cancelOllamaUrlEdit();
      else if (editingMcpConfigPath) cancelMcpConfigPathEdit();
      else if (editingChatModel) cancelChatModelEdit();
      else if (editingOpenrouterApiKey) cancelOpenrouterApiKeyEdit();
      else if (picker) closePicker();
      else {
        onBack();
        return;
      }
      return;
    }
    if ((DEFAULT_KEYS.back as readonly string[]).includes(effectiveKey)) {
      if (editingOllamaUrl) cancelOllamaUrlEdit();
      else if (editingMcpConfigPath) cancelMcpConfigPathEdit();
      else if (editingChatModel) cancelChatModelEdit();
      else if (editingOpenrouterApiKey) cancelOpenrouterApiKeyEdit();
      else if (picker) closePicker();
      else onBack();
      return;
    }
    if ((DEFAULT_KEYS.quit as readonly string[]).includes(effectiveKey) || effectiveKey === "ctrl+q") quit();
  });

  const state = {
    preferences,
    modelsLoading,
    openRouterModelsLoading,
    inputDevicesLoading,
    outputDevicesLoading,
    selectedRow,
    picker,
    pickerIndex,
    effectivePickerIndex,
    pickerFilterText,
    setPickerFilterText,
    filteredPickerList,
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
