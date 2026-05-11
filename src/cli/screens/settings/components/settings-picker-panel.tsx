import { Box, Text } from "ink";

import { semantic } from "~/cli/theme/semantic.js";
import { PICKER_TITLES } from "../constants.js";
import { pickerItemLabel, useSettingsStore } from "../store.js";

/** Active picker (model, voice, provider, …). */
export function SettingsPickerPanel() {
  const [
    {
      picker,
      modelsLoading,
      ollamaModelsError,
      openRouterModelsLoading,
      openRouterModelsError,
      pickerFilterText,
      visiblePickerSlice,
      visiblePickerStart,
      pickerLen,
      visiblePickerRows,
      effectivePickerIndex,
    },
  ] = useSettingsStore();

  if (!picker) return null;

  const pickerScrollPrefix =
    pickerLen > visiblePickerRows
      ? `${visiblePickerStart + 1}-${Math.min(visiblePickerStart + visiblePickerSlice.length, pickerLen)} of ${pickerLen} · `
      : "";

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{PICKER_TITLES[picker]}</Text>
      {picker === "model" && modelsLoading ? (
        <Box marginTop={1}>
          <Text dimColor>Loading models from Ollama…</Text>
        </Box>
      ) : null}
      {picker === "model" && !modelsLoading && ollamaModelsError ? (
        <Box marginTop={1}>
          <Text color={semantic.error}>{ollamaModelsError.message}</Text>
        </Box>
      ) : null}
      {picker === "model" &&
      !modelsLoading &&
      !ollamaModelsError &&
      pickerLen === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>
            No models found. Pull one with the ollama CLI, then reopen this
            picker. Confirm Ollama URL on the settings list if connection fails.
          </Text>
        </Box>
      ) : null}
      {picker === "openRouterModel" && openRouterModelsLoading ? (
        <Box marginTop={1}>
          <Text dimColor>Loading OpenRouter model list…</Text>
        </Box>
      ) : null}
      {picker === "openRouterModel" &&
      !openRouterModelsLoading &&
      openRouterModelsError ? (
        <Box marginTop={1}>
          <Text color={semantic.error}>{openRouterModelsError.message}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>Filter: </Text>
        <Text>{pickerFilterText || "(type to filter)"}</Text>
      </Box>
      {visiblePickerSlice.map((item, i) => {
        const actualIndex = visiblePickerStart + i;
        const selected = actualIndex === effectivePickerIndex;
        const label = pickerItemLabel(item);
        return (
          <Box key={actualIndex}>
            <Text color={selected ? semantic.accent : undefined}>
              {selected ? "› " : "  "}
              {label}
            </Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>
          {pickerScrollPrefix}
          ↑/↓ scroll · Type to filter · Enter confirm · Esc cancel · q quit
        </Text>
      </Box>
    </Box>
  );
}
