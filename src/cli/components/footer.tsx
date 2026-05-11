import { Box, Text } from "ink";

import { semantic } from "~/cli/theme/semantic.js";

export interface FooterItem {
  key: string;
  label: string;
}

export interface FooterProps {
  items: FooterItem[];
}

export function Footer({ items }: FooterProps) {
  return (
    <Box marginTop={1} flexDirection="row" flexWrap="wrap">
      {items.map((item, i) => (
        <Box key={item.key}>
          <Text dimColor>
            <Text bold color={semantic.accent}>
              {item.key}
            </Text>
            <Text> {item.label}</Text>
            {i < items.length - 1 && <Text> · </Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
