import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/cli/components/index.js";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import {
  useKeyboard,
  useMcpStatuses,
  usePreferences,
} from "~/cli/hooks/index.js";
import { quit } from "~/cli/quit.js";
import { StatusTable } from "./components/status-table.js";
import { getSummaryCounts, Summary } from "./components/summary.js";

export interface McpStatusScreenProps {
  onBack: () => void;
}

export function McpStatusScreen({ onBack }: McpStatusScreenProps) {
  const { preferences } = usePreferences();
  const { statuses, loading, error, refresh } = useMcpStatuses({
    configPath: preferences.mcpConfigPath,
  });

  useKeyboard({
    bindings: [
      { keys: [...DEFAULT_KEYS.back], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: quit },
      { keys: [...DEFAULT_KEYS.refresh], action: refresh },
    ],
  });
  const counts = getSummaryCounts(statuses);

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="MCP servers" subtitle={preferences.mcpConfigPath} />

      {loading ? (
        <Loading message="Connecting..." />
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : statuses.length === 0 ? (
        <Text dimColor>No config at path or no servers defined.</Text>
      ) : (
        <>
          <StatusTable rows={statuses} />
          <Summary counts={counts} />
        </>
      )}

      <Footer
        items={[
          { key: "r", label: "refresh" },
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
