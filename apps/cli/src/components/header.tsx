import { Box, Text } from "ink";

import { semantic } from "~/theme/semantic.js";

export interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header = ({ title, subtitle }: HeaderProps) => (
  <Box marginBottom={1} flexDirection="column">
    <Text bold color={semantic.accent}>
      {title}
    </Text>
    {subtitle !== undefined && <Text dimColor>{subtitle}</Text>}
  </Box>
);
