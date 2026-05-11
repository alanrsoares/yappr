import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";

import {
  getEffectiveKey,
  type ExtendedKey,
  type InkKeyWithAlt,
} from "~/cli/hooks/index.js";
import { clampSelectedIndex, cycleIndex } from "~/cli/list-nav.js";
import { semantic } from "~/cli/theme/semantic.js";
import { filterSlashCommands, listSlashCommands } from "../slash-commands.js";

const MAX_VISIBLE = 8;

export interface SlashCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmitLine: (line: string, explicitCommandName: string | undefined) => void;
}

export function SlashCommandInput({
  value,
  onChange,
  onSubmitLine,
}: SlashCommandInputProps) {
  const query = value.startsWith("/") ? value.slice(1) : "";
  const filtered = useMemo(() => filterSlashCommands(query), [query]);
  const noMatch = query.trim().length > 0 && filtered.length === 0;
  const list = noMatch
    ? []
    : filtered.length > 0
      ? filtered
      : [...listSlashCommands()];
  const [selectedIndex, setSelectedIndex] = useState(0);

  const n = list.length;
  const effectiveIndex = clampSelectedIndex(selectedIndex, n);
  const windowStart =
    n <= MAX_VISIBLE
      ? 0
      : Math.min(Math.max(0, effectiveIndex - 3), n - MAX_VISIBLE);
  const visible = list.slice(windowStart, windowStart + MAX_VISIBLE);

  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);

    if (effectiveKey === "return") {
      const pick = n > 0 ? list[effectiveIndex] : undefined;
      onSubmitLine(value, pick?.name);
      return;
    }
    if (effectiveKey === "upArrow") {
      setSelectedIndex((i) => cycleIndex(i, n, -1));
      return;
    }
    if (effectiveKey === "downArrow") {
      setSelectedIndex((i) => cycleIndex(i, n, 1));
      return;
    }
    if (effectiveKey === "backspace" || key.backspace) {
      setSelectedIndex(0);
      if (value.length <= 1) onChange("");
      else onChange(value.slice(0, -1));
      return;
    }
    if (key.ctrl || key.meta || (key as InkKeyWithAlt).alt) return;

    if (input && !key.return) {
      setSelectedIndex(0);
      onChange(value + input);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="row">
        <Text color={semantic.accent}>{value}</Text>
        <Text dimColor>▏</Text>
      </Box>
      <Box flexDirection="column" marginTop={0} paddingLeft={1}>
        {noMatch && <Text dimColor>No matches — backspace or try /help</Text>}
        {!noMatch &&
          visible.map((cmd, i) => {
            const idx = windowStart + i;
            const selected = idx === effectiveIndex;
            return (
              <Box key={cmd.name}>
                {selected ? (
                  <Text color={semantic.accent} bold>
                    › /{cmd.name}{" "}
                    <Text dimColor bold={false}>
                      — {cmd.description}
                    </Text>
                  </Text>
                ) : (
                  <Text dimColor>
                    {"  "}/{cmd.name} — {cmd.description}
                  </Text>
                )}
              </Box>
            );
          })}
      </Box>
    </Box>
  );
}
