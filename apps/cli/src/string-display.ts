import stringWidth from "string-width";

const cols = (s: string) => stringWidth(s);

/** Fit as much of `ellipsis` as allowed by `maxCols` (each grapheme tested). */
function ellipsisPrefix(ellipsis: string, maxCols: number): string {
  let acc = "";
  for (const ch of ellipsis) {
    const next = acc + ch;
    if (cols(next) > maxCols) break;
    acc = next;
  }
  return acc;
}

/** Truncate by terminal display width (wide chars / emoji count as multiple columns). */
export function truncateDisplayWidth(
  text: string,
  maxCols: number,
  ellipsis = "…",
): string {
  if (maxCols <= 0) return "";
  if (cols(text) <= maxCols) return text;

  const ellW = cols(ellipsis);
  if (maxCols <= ellW) return ellipsisPrefix(ellipsis, maxCols);

  const budget = maxCols - ellW;
  let end = text.length;
  while (end > 0 && cols(text.slice(0, end)) > budget) {
    end -= 1;
  }
  return text.slice(0, end) + ellipsis;
}
