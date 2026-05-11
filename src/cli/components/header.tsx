import { Box, Text } from "ink";

import { semantic } from "~/cli/theme/semantic.js";

export interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text bold color={semantic.accent}>
        {title}
      </Text>
      {subtitle !== undefined && <Text dimColor>{subtitle}</Text>}
    </Box>
  );
}
