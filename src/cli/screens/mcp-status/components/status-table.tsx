import { Box, Text } from "ink";

import type { ServerStatus } from "~/sdk/types.js";

const HEADERS = ["Server", "Status", "Tools", "Transport", "Message"] as const;

function statusColor(
  status: ServerStatus["status"],
): "green" | "red" | "yellow" {
  if (status === "[OK] Connected") return "green";
  if (status === "[FAIL] Failed") return "red";
  return "yellow";
}

function getCell(row: ServerStatus, col: (typeof HEADERS)[number]): string {
  switch (col) {
    case "Server":
      return row.id;
    case "Status":
      return row.status;
    case "Tools":
      return String(row.tools);
    case "Transport":
      return row.transport ?? "—";
    case "Message":
      return row.message;
    default:
      return "";
  }
}

export interface StatusTableProps {
  rows: ServerStatus[];
}

const pad = (s: string, w: number) => (s ?? "").padEnd(w);
const sep = (w: number) => "─".repeat(w + 2);

export function StatusTable({ rows }: StatusTableProps) {
  if (rows.length === 0) return null;

  const colWidths = HEADERS.map((h) => {
    const max = Math.max(h.length, ...rows.map((r) => getCell(r, h).length));
    return max;
  });

  const top = "┌" + colWidths.map(sep).join("┬") + "┐";
  const headSep = "├" + colWidths.map(sep).join("┼") + "┤";
  const bottom = "└" + colWidths.map(sep).join("┴") + "┘";

  function renderRow(row: ServerStatus, index: number) {
    const w1 = colWidths[1] ?? 0;
    const statusPadded = pad(row.status, w1);
    return (
      <Box key={`${row.id}-${index}`}>
        <Text>
          {"│ "}
          {pad(row.id, colWidths[0] ?? 0)}
          {" │ "}
        </Text>
        <Text color={statusColor(row.status)}>{statusPadded}</Text>
        <Text>
          {" │ "}
          {pad(String(row.tools), colWidths[2] ?? 0)}
          {" │ "}
          {pad(row.transport ?? "—", colWidths[3] ?? 0)}
          {" │ "}
          {pad(row.message, colWidths[4] ?? 0)}
          {" │"}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{top}</Text>
      <Text>
        {"│ "}
        {HEADERS.map((h, i) => pad(h, colWidths[i] ?? 0)).join(" │ ")}
        {" │"}
      </Text>
      <Text>{headSep}</Text>
      {rows.map(renderRow)}
      <Text>{bottom}</Text>
    </Box>
  );
}
