import { Fragment } from "react";

import { Box, Text } from "ink";

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
  return (
    <Box marginTop={2}>
      <Text dimColor>
        {items.map((item, i) => (
          <Fragment key={item.key}>
            {i > 0 && separator}
            <Text bold>{item.key}</Text>
            <Text> {item.label}</Text>
          </Fragment>
        ))}
      </Text>
    </Box>
  );
}
