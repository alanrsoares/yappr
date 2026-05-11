import { Box, Text } from "ink";

import { semantic } from "~/cli/theme/semantic.js";
import type { MenuItem } from "~/cli/types.js";

export interface MenuProps {
  items: MenuItem[];
  selectedIndex: number;
}

export function Menu({ items, selectedIndex }: MenuProps) {
  return (
    <Box flexDirection="column" gap={0}>
      {items.map((item, i) => (
        <Box key={item.id}>
          <Text color={i === selectedIndex ? semantic.accent : undefined}>
            {i === selectedIndex ? "› " : "  "}
            {item.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
