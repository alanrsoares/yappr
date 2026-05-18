import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/components/index.js";
import { DEFAULT_KEYS } from "~/constants.js";
import { FOOTER_MCP_STATUS } from "~/footer-items.js";
import { useKeyboard, useMcpStatuses, usePreferences } from "~/hooks/index.js";
import { quit } from "~/quit.js";
import { semantic } from "~/theme/semantic.js";
import { StatusTable } from "./components/status-table.js";
import { getSummaryCounts, Summary } from "./components/summary.js";

export interface McpStatusScreenProps {
  onBack: () => void;
}

function McpStatusBody({
  loading,
  error,
  statuses,
  counts,
}: {
  loading: boolean;
  error: string | null;
  statuses: ReturnType<typeof useMcpStatuses>["statuses"];
  counts: ReturnType<typeof getSummaryCounts>;
}) {
  if (loading) return <Loading message="Connecting..." />;
  if (error) return <Text color={semantic.error}>{error}</Text>;
  if (statuses.length === 0)
    return <Text dimColor>No config at path or no servers defined.</Text>;

  return (
    <>
      <StatusTable rows={statuses} />
      <Summary counts={counts} />
    </>
  );
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

      <McpStatusBody
        loading={loading}
        error={error}
        statuses={statuses}
        counts={counts}
      />

      <Footer items={FOOTER_MCP_STATUS} />
    </Box>
  );
}
