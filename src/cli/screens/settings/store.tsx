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
  | "model"
  | "voice"
  | "input"
  | "output"
  | "narrationModel"
  | null;

export interface SettingsStoreInitialState {
  onBack: () => void;
}

const ROW_COUNT = 7;
const cycle = (i: number, n: number, d: number) => (i + n + d) % n;

function useSettingsStoreLogic(initialState?: SettingsStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => { });

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

  const narrationModelList = useMemo(
    () => ["(same as chat)", ...ollamaModels],
    [ollamaModels],
  );
  const pickerList = picker
    ? {
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
        setPicker("model");
        setPickerIndex(
          Math.max(0, ollamaModels.indexOf(preferences.defaultOllamaModel)),
        );
        break;
      case 1:
        setPicker("voice");
        setPickerIndex(Math.max(0, voices.indexOf(preferences.defaultVoice)));
        break;
      case 2:
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
      case 3:
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
      case 5:
        setPicker("narrationModel");
        setPickerIndex(
          preferences.narrationModel
            ? Math.max(0, ollamaModels.indexOf(preferences.narrationModel) + 1)
            : 0,
        );
        break;
      case 6:
        setEditingOllamaUrl(true);
        setOllamaUrlInputValue(preferences.ollamaBaseUrl);
        break;
      // case 4: narration toggle, no picker
    }
  }, [
    selectedRow,
    preferences.defaultOllamaModel,
    preferences.defaultVoice,
    preferences.defaultInputDeviceIndex,
    preferences.defaultOutputDeviceIndex,
    preferences.narrationModel,
    preferences.ollamaBaseUrl,
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

  const confirmPicker = useCallback(() => {
    switch (picker) {
      case "model":
        if (ollamaModels[pickerIndex]) {
          savePreferences({ defaultOllamaModel: ollamaModels[pickerIndex]! });
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

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () =>
          editingOllamaUrl
            ? undefined
            : picker
              ? setPickerIndex((i) => cycle(i, pickerLen, -1))
              : setSelectedRow((r) => cycle(r, ROW_COUNT, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () =>
          editingOllamaUrl
            ? undefined
            : picker
              ? setPickerIndex((i) => cycle(i, pickerLen, 1))
              : setSelectedRow((r) => cycle(r, ROW_COUNT, 1)),
      },
      {
        keys: ["return", "enter"],
        action: editingOllamaUrl
          ? confirmOllamaUrlEdit
          : picker
            ? confirmPicker
            : selectedRow === 4
              ? () =>
                  savePreferences({
                    useNarrationForTTS: !preferences.useNarrationForTTS,
                  })
              : openPicker,
      },
      ...(editingOllamaUrl
        ? [{ keys: ["escape"], action: cancelOllamaUrlEdit }]
        : picker
          ? [{ keys: ["escape"], action: closePicker }]
          : []),
      {
        keys: [...DEFAULT_KEYS.back],
        action: editingOllamaUrl
          ? cancelOllamaUrlEdit
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
    setOllamaUrlInputValue,
    confirmOllamaUrlEdit,
    cancelOllamaUrlEdit,
  };

  const actions = {
    onBack,
  };

  return [state, actions] as const;
}

export const { useContainer: useSettingsStore, Provider: SettingsProvider } =
  createContainer<
    ReturnType<typeof useSettingsStoreLogic>,
    SettingsStoreInitialState
  >(useSettingsStoreLogic);
