import { Box, Text, useStdout } from "ink";

export interface FooterItem {
  key: string;
  label: string;
}

export interface FooterProps {
  items: FooterItem[];
  /** Gap between items, e.g. " · " */
  separator?: string;
}

export function Footer({ items, separator = " · " }: FooterProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;
  // Account for screen padding (1 each side) so footer doesn't overflow
  const width = Math.max(0, terminalWidth - 2);

  return (
    <Box
      marginTop={2}
      flexWrap="nowrap"
      width={width}
      borderStyle="single"
      borderColor="gray"
    >
      <Box
        paddingX={1}
        paddingY={0}
        width="100%"
        minWidth={0}
        flexWrap="nowrap"
        flexDirection="row"
      >
        {items.map((item, i) => (
          <Box key={item.key}>
            <Text>{i > 0 && separator}</Text>
            <Text bold>{item.key}</Text>
            <Text dimColor> {item.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
