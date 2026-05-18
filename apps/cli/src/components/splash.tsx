import { useEffect } from "react";
import { Box, Text, useInput } from "ink";

import { semantic } from "~/theme/semantic.js";

const BANNER = [
  "██╗░░░██╗░█████╗░██████╗░██████╗░██████╗░",
  "╚██╗░██╔╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗",
  "░╚████╔╝░███████║██████╔╝██████╔╝██████╔╝",
  "░░╚██╔╝░░██╔══██║██╔═══╝░██╔═══╝░██╔══██╗",
  "░░░██║░░░██║░░██║██║░░░░░██║░░░░░██║░░██║",
  "░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░░░░╚═╝░░░░░╚═╝░░╚═╝",
];

const BANNER_WIDTH = BANNER[0]?.length ?? 0;

export interface SplashProps {
  version: string;
  tagline?: string;
  autoDismissMs?: number;
  onDismiss: () => void;
}

export function Splash({
  version,
  tagline = "Voice & tools",
  autoDismissMs = 1400,
  onDismiss,
}: SplashProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [autoDismissMs, onDismiss]);

  useInput(() => onDismiss());

  const versionLine = `══════════════════════════════════ v${version}`.padEnd(
    BANNER_WIDTH,
    "═",
  );

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      paddingY={1}
    >
      <Box flexDirection="column">
        {BANNER.map((line, i) => (
          <Text key={`b-${i}`} color={semantic.accent} bold>
            {line}
          </Text>
        ))}
        <Text color={semantic.frame}>{versionLine}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{tagline}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>press any key to continue</Text>
      </Box>
    </Box>
  );
}
