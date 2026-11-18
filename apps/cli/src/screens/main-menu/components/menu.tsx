import { Box, Text } from "ink";

import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { semantic } from "~/theme/semantic.js";
import type { MenuItem } from "~/types.js";

export interface MenuProps {
  items: MenuItem[];
  selectedIndex: number;
}

const LABEL_COL_WIDTH = 14;

function MenuRow({
  item,
  index,
  selected,
}: {
  item: MenuItem;
  index: number;
  selected: boolean;
}) {
  return (
    <Box flexDirection="row">
      <Text color={selected ? semantic.accent : undefined} bold={selected}>
        {listSelectionPrefix(selected)}
      </Text>
      <Text dimColor>{index + 1} </Text>
      <Text color={selected ? semantic.accent : undefined} bold={selected}>
        {item.label.padEnd(LABEL_COL_WIDTH)}
      </Text>
      {item.description !== undefined && (
        <Text dimColor>{item.description}</Text>
      )}
      {item.done && <Text color={semantic.success}> ✓</Text>}
    </Box>
  );
}

export function Menu({ items, selectedIndex }: MenuProps) {
  const coreItems = items.filter((item) => item.group !== "config");
  const configItems = items.filter((item) => item.group === "config");

  return (
    <Box flexDirection="column">
      <Text dimColor bold>
        Workspace
      </Text>
      <Box flexDirection="column" marginTop={0} marginBottom={1}>
        {coreItems.map((item) => {
          const index = items.indexOf(item);
          return (
            <MenuRow
              key={item.id}
              item={item}
              index={index}
              selected={index === selectedIndex}
            />
          );
        })}
      </Box>

      {configItems.length > 0 && (
        <>
          <Text dimColor bold>
            Configuration
          </Text>
          <Box flexDirection="column" marginTop={0}>
            {configItems.map((item) => {
              const index = items.indexOf(item);
              return (
                <MenuRow
                  key={item.id}
                  item={item}
                  index={index}
                  selected={index === selectedIndex}
                />
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}
