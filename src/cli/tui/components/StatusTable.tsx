import React from "react";
import { Box, Text } from "ink";
import type { ServerStatus } from "../../../sdk/mcp.js";

const HEADERS = ["Server", "Status", "Tools", "Transport", "Message"] as const;

function statusColor(status: ServerStatus["status"]): "green" | "red" | "yellow" {
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

export function StatusTable({ rows }: StatusTableProps) {
  if (rows.length === 0) return null;

  const colWidths = HEADERS.map((h, i) => {
    const max = Math.max(
      h.length,
      ...rows.map((r) => getCell(r, h).length)
    );
    return max;
  });

  const sep = (w: number) => "─".repeat(w + 2);
  const top = "┌" + colWidths.map(sep).join("┬") + "┐";
  const headSep = "├" + colWidths.map(sep).join("┼") + "┤";
  const bottom = "└" + colWidths.map(sep).join("┴") + "┘";

  const pad = (s: string, w: number) => (s ?? "").padEnd(w);

  return (
    <Box flexDirection="column">
      <Text>{top}</Text>
      <Text>
        {"│ "}
        {HEADERS.map((h, i) => pad(h, colWidths[i] ?? 0)).join(" │ ")}
        {" │"}
      </Text>
      <Text>{headSep}</Text>
      {rows.map((r, i) => {
        const w1 = colWidths[1] ?? 0;
        const statusPadded = pad(r.status, w1);
        return (
          <Box key={`${r.id}-${i}`}>
            <Text>
              {"│ "}
              {pad(r.id, colWidths[0] ?? 0)}
              {" │ "}
            </Text>
            <Text color={statusColor(r.status)}>{statusPadded}</Text>
            <Text>
              {" │ "}
              {pad(String(r.tools), colWidths[2] ?? 0)}
              {" │ "}
              {pad(r.transport ?? "—", colWidths[3] ?? 0)}
              {" │ "}
              {pad(r.message, colWidths[4] ?? 0)}
              {" │"}
            </Text>
          </Box>
        );
      })}
      <Text>{bottom}</Text>
    </Box>
  );
}
