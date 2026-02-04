export type ColumnAlign = "left" | "right";

/**
 * Renders a box-drawn table to stdout. Column widths are computed as
 * max(header length, max cell length) per column.
 */
export function renderTable(
  headers: string[],
  rows: string[][],
  options?: { align?: ColumnAlign[] }
): void {
  const align = options?.align ?? headers.map(() => "left" as ColumnAlign);

  const colWidths = headers.map((h, i) => {
    const headerLen = (h ?? "").length;
    const maxCellLen =
      rows.length === 0 ? 0 : Math.max(...rows.map((row) => (row[i] ?? "").length));
    return Math.max(headerLen, maxCellLen);
  });

  const sep = (n: number) => "─".repeat(n + 2);
  const top = "\n┌" + colWidths.map(sep).join("┬") + "┐";
  const headSep = "├" + colWidths.map(sep).join("┼") + "┤";
  const bottom = "└" + colWidths.map(sep).join("┴") + "┘";

  const pad = (s: string, w: number, i: number) =>
    align[i] === "right" ? (s ?? "").padStart(w) : (s ?? "").padEnd(w);

  const formatRow = (cells: string[]) =>
    "│ " + cells.map((cell, i) => pad(cell ?? "", colWidths[i] ?? 0, i)).join(" │ ") + " │";

  console.log(top);
  console.log(formatRow(headers));
  console.log(headSep);
  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log(bottom + "\n");
}
