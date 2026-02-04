import stringWidth from "string-width";

export type ColumnAlign = "left" | "right";

/**
 * Renders a box-drawn table to stdout. Column widths are computed using
 * terminal display width (so emojis and fullwidth chars count as 2 columns).
 */
export function renderTable(
  headers: string[],
  rows: string[][],
  options?: { align?: ColumnAlign[] }
): void {
  const align = options?.align ?? headers.map(() => "left" as ColumnAlign);

  const displayWidth = (s: string) => stringWidth(s ?? "");
  const allCells = (i: number): string[] => [
    headers[i] ?? "",
    ...rows.map((row) => row[i] ?? ""),
  ];

  const colDisplayWidth = headers.map((_, i) =>
    Math.max(...allCells(i).map((c) => displayWidth(c)))
  );

  const paddedCellLength = (cell: string, colIndex: number): number => {
    const w = colDisplayWidth[colIndex] ?? 0;
    return (cell ?? "").length + Math.max(0, w - displayWidth(cell));
  };
  const colCharWidth = headers.map((_, i) =>
    Math.max(...allCells(i).map((c) => paddedCellLength(c, i)))
  );

  const sep = (n: number) => "─".repeat(n + 2);
  const top = "\n┌" + colCharWidth.map(sep).join("┬") + "┐";
  const headSep = "├" + colCharWidth.map(sep).join("┼") + "┤";
  const bottom = "└" + colCharWidth.map(sep).join("┴") + "┘";

  const pad = (s: string, colIndex: number) => {
    const raw = s ?? "";
    const dw = colDisplayWidth[colIndex] ?? 0;
    const charW = colCharWidth[colIndex] ?? 0;
    const rightPadForDisplay = Math.max(0, dw - displayWidth(raw));
    if (align[colIndex] === "right") {
      const paddedLen = raw.length + rightPadForDisplay;
      const leftSpaces = Math.max(0, charW - paddedLen);
      return " ".repeat(leftSpaces) + raw + " ".repeat(rightPadForDisplay);
    }
    let result = raw + " ".repeat(rightPadForDisplay);
    return result + " ".repeat(Math.max(0, charW - result.length));
  };

  const formatRow = (cells: string[]) =>
    "│ " + cells.map((cell, i) => pad(cell, i)).join(" │ ") + " │";

  console.log(top);
  console.log(formatRow(headers));
  console.log(headSep);
  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log(bottom + "\n");
}
