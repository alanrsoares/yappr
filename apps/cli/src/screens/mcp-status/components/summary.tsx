import { Box, Text } from "ink";

import { semantic } from "~/theme/semantic.js";
import type { SummaryCounts } from "~/types.js";

export interface SummaryProps {
  counts: SummaryCounts;
}

export function Summary({ counts }: SummaryProps) {
  const { connected, failed, skipped, totalTools } = counts;

  return (
    <Box marginTop={1} flexDirection="row" gap={2}>
      <Text color={semantic.success}>{connected} connected</Text>
      {failed > 0 && <Text color={semantic.error}>{failed} failed</Text>}
      {skipped > 0 && <Text color={semantic.notice}>{skipped} skipped</Text>}
      <Text dimColor> · </Text>
      <Text dimColor>{totalTools} tools</Text>
    </Box>
  );
}

export function getSummaryCounts(
  items: Array<{ status: string; tools: number }>,
): SummaryCounts {
  const connected = items.filter((s) => s.status === "[OK] Connected").length;
  const failed = items.filter((s) => s.status === "[FAIL] Failed").length;
  const skipped = items.filter((s) => s.status === "[SKIP] Skipped").length;
  const totalTools = items.reduce((n, s) => n + s.tools, 0);
  return { connected, failed, skipped, totalTools };
}
