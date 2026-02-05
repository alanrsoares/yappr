import { useCallback, useState } from "react";

import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, usePreferences, useQuery } from "~/cli/hooks/index.js";
import {
  listInputDevices,
  listOllamaModels,
  listOutputDevices,
  listVoices,
} from "~/cli/services/yappr.js";
import { createContainer } from "~/lib/unstated.js";

export type PickerKind = "model" | "voice" | "input" | "output" | null;

export interface SettingsStoreInitialState {
  onBack: () => void;
}

const ROW_COUNT = 4;
const cycle = (i: number, n: number, d: number) => (i + n + d) % n;

function useSettingsStoreLogic(initialState?: SettingsStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const { preferences, savePreferences } = usePreferences();
  const { data: ollamaModels = [], isLoading: modelsLoading } =
    useQuery(listOllamaModels);
  const { data: voices = [] } = useQuery(listVoices);
  const { data: inputDevices = [], isLoading: inputDevicesLoading } =
    useQuery(listInputDevices);
  const { data: outputDevices = [], isLoading: outputDevicesLoading } =
    useQuery(listOutputDevices);

  const [selectedRow, setSelectedRow] = useState(0);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerIndex, setPickerIndex] = useState(0);

  const pickerList = picker
    ? {
        model: ollamaModels,
        voice: voices,
        input: inputDevices,
        output: outputDevices,
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
    if (selectedRow === 0) {
      setPicker("model");
      const i = ollamaModels.indexOf(preferences.defaultOllamaModel);
      setPickerIndex(i >= 0 ? i : 0);
    } else if (selectedRow === 1) {
      setPicker("voice");
      const i = voices.indexOf(preferences.defaultVoice);
      setPickerIndex(i >= 0 ? i : 0);
    } else if (selectedRow === 2) {
      setPicker("input");
      const i = inputDevices.findIndex(
        (d) => d.index === preferences.defaultInputDeviceIndex,
      );
      setPickerIndex(i >= 0 ? i : 0);
    } else {
      setPicker("output");
      const i = outputDevices.findIndex(
        (d) => d.index === preferences.defaultOutputDeviceIndex,
      );
      setPickerIndex(i >= 0 ? i : 0);
    }
  }, [
    selectedRow,
    preferences.defaultOllamaModel,
    preferences.defaultVoice,
    preferences.defaultInputDeviceIndex,
    preferences.defaultOutputDeviceIndex,
    ollamaModels,
    voices,
    inputDevices,
    outputDevices,
  ]);

  const confirmPicker = useCallback(() => {
    if (picker === "model" && ollamaModels[pickerIndex]) {
      savePreferences({ defaultOllamaModel: ollamaModels[pickerIndex]! });
    } else if (picker === "voice" && voices[pickerIndex]) {
      savePreferences({ defaultVoice: voices[pickerIndex]! });
    } else if (picker === "input" && inputDevices[pickerIndex]) {
      savePreferences({
        defaultInputDeviceIndex: inputDevices[pickerIndex]!.index,
      });
    } else if (picker === "output" && outputDevices[pickerIndex]) {
      savePreferences({
        defaultOutputDeviceIndex: outputDevices[pickerIndex]!.index,
      });
    }
    setPicker(null);
  }, [
    picker,
    pickerIndex,
    ollamaModels,
    voices,
    inputDevices,
    outputDevices,
    savePreferences,
  ]);

  const closePicker = useCallback(() => setPicker(null), []);

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () =>
          picker
            ? setPickerIndex((i) => cycle(i, pickerLen, -1))
            : setSelectedRow((r) => cycle(r, ROW_COUNT, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () =>
          picker
            ? setPickerIndex((i) => cycle(i, pickerLen, 1))
            : setSelectedRow((r) => cycle(r, ROW_COUNT, 1)),
      },
      {
        keys: ["return", "enter"],
        action: picker ? confirmPicker : openPicker,
      },
      ...(picker ? [{ keys: ["escape"], action: closePicker }] : []),
      {
        keys: [...DEFAULT_KEYS.back],
        action: picker ? closePicker : onBack,
      },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
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
