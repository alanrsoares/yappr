import { Box, Text } from "ink";

import { useTerminalWidth } from "~/hooks/useTerminalWidth.js";
import { truncateDisplayWidth } from "~/string-display.js";
import { semantic } from "~/theme/semantic.js";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function Header({ title, subtitle, badge }: HeaderProps) {
  const terminalWidth = useTerminalWidth();
  const ruleWidth = Math.max(12, terminalWidth - 4);
  const subtitleText =
    subtitle !== undefined
      ? truncateDisplayWidth(subtitle, ruleWidth)
      : undefined;

  return (
    <Box marginBottom={1} flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={semantic.accent}>
          {title}
        </Text>
        {badge !== undefined && <Text dimColor>{badge}</Text>}
      </Box>
      {subtitleText !== undefined && <Text dimColor>{subtitleText}</Text>}
      <Text color={semantic.frame}>{"─".repeat(ruleWidth)}</Text>
    </Box>
  );
}
