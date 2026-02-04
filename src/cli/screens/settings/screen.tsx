import { useCallback, useState } from "react";
import { Box, Text } from "ink";

import { Footer, Header } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import {
  useKeyboard,
  usePreferences,
  useQuery,
} from "~/cli/hooks/index.js";
import {
  listInputDevices,
  listOllamaModels,
  listOutputDevices,
  listVoices,
} from "~/cli/services/yappr.js";

export interface SettingsScreenProps {
  onBack: () => void;
}

type PickerKind = "model" | "voice" | "input" | "output" | null;

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { preferences, savePreferences } = usePreferences();
  const { data: ollamaModels = [], isLoading: modelsLoading } =
    useQuery(listOllamaModels);
  const { data: voices = [], isLoading: voicesLoading } = useQuery(listVoices);
  const { data: inputDevices = [], isLoading: inputDevicesLoading } =
    useQuery(listInputDevices);
  const { data: outputDevices = [], isLoading: outputDevicesLoading } =
    useQuery(listOutputDevices);

  const [selectedRow, setSelectedRow] = useState(0);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerIndex, setPickerIndex] = useState(0);

  const rowCount = 4;
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

  useKeyboard({
    bindings: [
      ...(picker
        ? [
            {
              keys: ["upArrow", "k"],
              action: () => {
                const len =
                  picker === "model"
                    ? ollamaModels.length
                    : picker === "voice"
                      ? voices.length
                      : picker === "input"
                        ? inputDevices.length
                        : outputDevices.length;
                setPickerIndex((i) => (i > 0 ? i - 1 : len - 1));
              },
            },
            {
              keys: ["downArrow", "j"],
              action: () => {
                const len =
                  picker === "model"
                    ? ollamaModels.length
                    : picker === "voice"
                      ? voices.length
                      : picker === "input"
                        ? inputDevices.length
                        : outputDevices.length;
                setPickerIndex((i) => (i < len - 1 ? i + 1 : 0));
              },
            },
            { keys: ["return", "enter"], action: confirmPicker },
            { keys: ["escape"], action: () => setPicker(null) },
          ]
        : [
            {
              keys: ["upArrow", "k"],
              action: () =>
                setSelectedRow((r) => (r > 0 ? r - 1 : rowCount - 1)),
            },
            {
              keys: ["downArrow", "j"],
              action: () =>
                setSelectedRow((r) => (r < rowCount - 1 ? r + 1 : 0)),
            },
            { keys: ["return", "enter"], action: openPicker },
          ]),
      { keys: [...DEFAULT_KEYS.back], action: picker ? () => setPicker(null) : onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Settings" subtitle="~/.yappr/settings.json" />

      {!picker ? (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={selectedRow === 0 ? "cyan" : undefined}>
              {selectedRow === 0 ? "› " : "  "}
            </Text>
            <Text>Ollama model: </Text>
            <Text dimColor={selectedRow !== 0}>
              {modelsLoading ? "…" : preferences.defaultOllamaModel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 1 ? "cyan" : undefined}>
              {selectedRow === 1 ? "› " : "  "}
            </Text>
            <Text>Default voice: </Text>
            <Text dimColor={selectedRow !== 1}>
              {preferences.defaultVoice}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 2 ? "cyan" : undefined}>
              {selectedRow === 2 ? "› " : "  "}
            </Text>
            <Text>Input device: </Text>
            <Text dimColor={selectedRow !== 2}>
              {inputDevicesLoading ? "…" : inputDeviceLabel}
            </Text>
          </Box>
          <Box>
            <Text color={selectedRow === 3 ? "cyan" : undefined}>
              {selectedRow === 3 ? "› " : "  "}
            </Text>
            <Text>Output device: </Text>
            <Text dimColor={selectedRow !== 3}>
              {outputDevicesLoading ? "…" : outputDeviceLabel}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to change · b back · q quit</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {picker === "model"
              ? "Choose Ollama model"
              : picker === "voice"
                ? "Choose voice"
                : picker === "input"
                  ? "Choose input device"
                  : "Choose output device"}
          </Text>
          {(picker === "model"
            ? ollamaModels
            : picker === "voice"
              ? voices
              : picker === "input"
                ? inputDevices
                : outputDevices
          ).map((item, i) => (
            <Box key={i}>
              <Text color={i === pickerIndex ? "cyan" : undefined}>
                {i === pickerIndex ? "› " : "  "}
                {typeof item === "string" ? item : item.name}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑/↓ move · Enter confirm · Esc cancel</Text>
          </Box>
        </Box>
      )}

      <Footer
        items={[
          { key: "b", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
