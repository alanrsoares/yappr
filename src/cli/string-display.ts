import stringWidth from "string-width";

/** Truncate by terminal display width (wide chars / emoji count as multiple columns). */
export function truncateDisplayWidth(
  text: string,
  maxCols: number,
  ellipsis = "…",
): string {
  if (maxCols <= 0) return "";
  if (stringWidth(text) <= maxCols) return text;

  const ellW = stringWidth(ellipsis);
  if (maxCols <= ellW) {
    let acc = "";
    for (const ch of ellipsis) {
      const next = acc + ch;
      if (stringWidth(next) > maxCols) break;
      acc = next;
    }
    return acc;
  }

  const budget = maxCols - ellW;
  let end = text.length;
  while (end > 0 && stringWidth(text.slice(0, end)) > budget) {
    end--;
  }
  return text.slice(0, end) + ellipsis;
}
