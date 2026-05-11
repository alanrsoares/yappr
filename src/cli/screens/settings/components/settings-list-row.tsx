import type { ReactNode } from "react";
import { Box, Text } from "ink";

import { semantic } from "~/cli/theme/semantic.js";

export interface SettingsListRowProps {
  index: number;
  selectedRow: number;
  label: string;
  value: ReactNode;
}

export function SettingsListRow({
  index,
  selectedRow,
  label,
  value,
}: SettingsListRowProps) {
  const selected = selectedRow === index;
  return (
    <Box>
      <Text color={selected ? semantic.accent : undefined}>
        {selected ? "› " : "  "}
      </Text>
      <Text>{label}</Text>
      <Text dimColor={!selected}>{value}</Text>
    </Box>
  );
}
