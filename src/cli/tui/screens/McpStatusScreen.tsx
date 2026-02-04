import { Box, Text } from "ink";
import {
  Footer,
  Header,
  Loading,
  StatusTable,
  Summary,
  getSummaryCounts,
} from "../components/index.js";
import { useKeyboard, useMcpStatuses } from "../hooks/index.js";
import { MCP_CONFIG_PATH, DEFAULT_KEYS } from "../constants.js";

export interface McpStatusScreenProps {
  onBack: () => void;
}

export function McpStatusScreen({ onBack }: McpStatusScreenProps) {
  const { statuses, loading, error, refresh } = useMcpStatuses({
    configPath: MCP_CONFIG_PATH,
  });

  useKeyboard({
    bindings: [
      { keys: [...DEFAULT_KEYS.back], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
      { keys: [...DEFAULT_KEYS.refresh], action: refresh },
    ],
  });
  const counts = getSummaryCounts(statuses);

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="MCP servers"
        subtitle={MCP_CONFIG_PATH}
      />

      {loading ? (
        <Loading message="Connecting..." />
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : statuses.length === 0 ? (
        <Text dimColor>
          No config at ~/.cursor/mcp.json or no servers defined.
        </Text>
      ) : (
        <>
          <StatusTable rows={statuses} />
          <Summary counts={counts} />
        </>
      )}

      <Footer
        items={[
          { key: "r", label: "refresh" },
          { key: "b", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
