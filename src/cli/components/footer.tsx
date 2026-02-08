import { Box, Text, useStdout } from "ink";

export interface FooterItem {
  key: string;
  label: string;
}

export interface FooterProps {
  items: FooterItem[];
  /** Gap between items, e.g. "  " */
  separator?: string;
}

export function Footer({ items, separator = "  " }: FooterProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;
  // Account for screen padding (1 each side)
  const width = Math.max(0, terminalWidth - 2);

  return (
    <Box marginTop={1} width={width}>
      {items.map((item, i) => (
        <Box key={item.key} marginRight={i < items.length - 1 ? 2 : 0}>
          <Text dimColor inverse>
            {" "}
            {item.key}{" "}
          </Text>
          <Text dimColor> {item.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
