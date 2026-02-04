import { Box, Text } from "ink";

export interface MenuItem {
  id: string;
  label: string;
}

export interface MenuProps {
  items: MenuItem[];
  selectedIndex: number;
}

export function Menu({ items, selectedIndex }: MenuProps) {
  return (
    <Box flexDirection="column" gap={0}>
      {items.map((item, i) => (
        <Box key={item.id}>
          <Text color={i === selectedIndex ? "cyan" : undefined}>
            {i === selectedIndex ? "› " : "  "}
            {item.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
