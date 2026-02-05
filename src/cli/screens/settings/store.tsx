import { useCallback, useMemo, useState } from "react";

import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, usePreferences, useQuery } from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import {
  listInputDevices,
  listOllamaModels,
  listOutputDevices,
  listVoices,
} from "~/cli/services/yappr.js";
import { createContainer } from "~/lib/unstated.js";

export type PickerKind =
  | "provider"
  | "model"
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
const cycle = (i: number, n: number, d: number) => (i + n + d) % n;

function useSettingsStoreLogic(initialState?: SettingsStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const { preferences, savePreferences } = usePreferences();
  const { data: ollamaModels = [], isLoading: modelsLoading } = useQuery(
    () => listOllamaModels(preferences.ollamaBaseUrl),
    { deps: [preferences.ollamaBaseUrl] },
  );
  const { data: voices = [] } = useQuery(listVoices);
  const { data: inputDevices = [], isLoading: inputDevicesLoading } =
    useQuery(listInputDevices);
  const { data: outputDevices = [], isLoading: outputDevicesLoading } =
    useQuery(listOutputDevices);

  const [selectedRow, setSelectedRow] = useState(0);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerIndex, setPickerIndex] = useState(0);
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
        voice: voices,
        input: inputDevices,
        output: outputDevices,
        narrationModel: narrationModelList,
      }[picker]
    : null;
  const pickerLen = pickerList?.length ?? 0;

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
        setPickerIndex(
          Math.max(
            0,
            PROVIDER_VALUES.indexOf(
              preferences.defaultChatProvider as ProviderValue,
            ),
          ),
        );
        break;
      case 1:
        if (preferences.defaultChatProvider === "openrouter") {
          setEditingChatModel(true);
          setChatModelInputValue(preferences.defaultChatModel);
        } else {
          setPicker("model");
          setPickerIndex(
            Math.max(0, ollamaModels.indexOf(preferences.defaultChatModel)),
          );
        }
        break;
      case 2:
        setPicker("voice");
        setPickerIndex(Math.max(0, voices.indexOf(preferences.defaultVoice)));
        break;
      case 3:
        setPicker("input");
        setPickerIndex(
          Math.max(
            0,
            inputDevices.findIndex(
              (d) => d.index === preferences.defaultInputDeviceIndex,
            ),
          ),
        );
        break;
      case 4:
        setPicker("output");
        setPickerIndex(
          Math.max(
            0,
            outputDevices.findIndex(
              (d) => d.index === preferences.defaultOutputDeviceIndex,
            ),
          ),
        );
        break;
      case 6:
        setPicker("narrationModel");
        setPickerIndex(
          preferences.narrationModel
            ? Math.max(0, ollamaModels.indexOf(preferences.narrationModel) + 1)
            : 0,
        );
        break;
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
    voices,
    inputDevices,
    outputDevices,
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
    switch (picker) {
      case "provider":
        if (PROVIDER_VALUES[pickerIndex]) {
          savePreferences({
            defaultChatProvider: PROVIDER_VALUES[pickerIndex] as ProviderValue,
          });
        }
        break;
      case "model":
        if (ollamaModels[pickerIndex]) {
          savePreferences({ defaultChatModel: ollamaModels[pickerIndex]! });
        }
        break;
      case "voice":
        if (voices[pickerIndex]) {
          savePreferences({ defaultVoice: voices[pickerIndex]! });
        }
        break;
      case "input":
        if (inputDevices[pickerIndex]) {
          savePreferences({
            defaultInputDeviceIndex: inputDevices[pickerIndex]!.index,
          });
        }
        break;
      case "output":
        if (outputDevices[pickerIndex]) {
          savePreferences({
            defaultOutputDeviceIndex: outputDevices[pickerIndex]!.index,
          });
        }
        break;
      case "narrationModel": {
        const raw = narrationModelList[pickerIndex];
        if (raw) {
          savePreferences({
            narrationModel: raw === "(same as chat)" ? "" : raw,
          });
        }
        break;
      }
    }
    setPicker(null);
  }, [
    picker,
    pickerIndex,
    ollamaModels,
    voices,
    inputDevices,
    outputDevices,
    narrationModelList,
    savePreferences,
  ]);

  const closePicker = useCallback(() => setPicker(null), []);

  const isEditing =
    editingOllamaUrl ||
    editingMcpConfigPath ||
    editingChatModel ||
    editingOpenrouterApiKey;

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () =>
          isEditing
            ? undefined
            : picker
              ? setPickerIndex((i) => cycle(i, pickerLen, -1))
              : setSelectedRow((r) => cycle(r, ROW_COUNT, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () =>
          isEditing
            ? undefined
            : picker
              ? setPickerIndex((i) => cycle(i, pickerLen, 1))
              : setSelectedRow((r) => cycle(r, ROW_COUNT, 1)),
      },
      {
        keys: ["return", "enter"],
        action: editingOllamaUrl
          ? confirmOllamaUrlEdit
          : editingMcpConfigPath
            ? confirmMcpConfigPathEdit
            : editingChatModel
              ? confirmChatModelEdit
              : editingOpenrouterApiKey
                ? confirmOpenrouterApiKeyEdit
                : picker
                  ? confirmPicker
                  : selectedRow === 5
                    ? () =>
                        savePreferences({
                          useNarrationForTTS: !preferences.useNarrationForTTS,
                        })
                    : openPicker,
      },
      ...(editingOllamaUrl
        ? [{ keys: ["escape"], action: cancelOllamaUrlEdit }]
        : editingMcpConfigPath
          ? [{ keys: ["escape"], action: cancelMcpConfigPathEdit }]
          : editingChatModel
            ? [{ keys: ["escape"], action: cancelChatModelEdit }]
            : editingOpenrouterApiKey
              ? [{ keys: ["escape"], action: cancelOpenrouterApiKeyEdit }]
              : picker
                ? [{ keys: ["escape"], action: closePicker }]
                : []),
      {
        keys: [...DEFAULT_KEYS.back],
        action: editingOllamaUrl
          ? cancelOllamaUrlEdit
          : editingMcpConfigPath
            ? cancelMcpConfigPathEdit
            : editingChatModel
              ? cancelChatModelEdit
              : editingOpenrouterApiKey
                ? cancelOpenrouterApiKeyEdit
                : picker
                  ? closePicker
                  : onBack,
      },
      { keys: [...DEFAULT_KEYS.quit], action: quit },
    ],
  });

  const state = {
    preferences,
    modelsLoading,
    inputDevicesLoading,
    outputDevicesLoading,
    selectedRow,
    picker,
    pickerIndex,
    pickerList,
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
