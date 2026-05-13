import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";

const USER_BUBBLE_FONT_FAMILY =
  '"JetBrains Mono", Menlo, Monaco, Consolas, monospace';
const USER_BUBBLE_FONT = `400 16px ${USER_BUBBLE_FONT_FAMILY}`;
const USER_BUBBLE_PADDING_X = 32;
const USER_BUBBLE_MIN_TEXT_WIDTH = 40;
const SHRINKWRAP_PRECISION_PX = 1;

export const normalizeBubbleText = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const measureUserTextBubbleWidth = (
  text: string,
  maxBubbleWidth: number,
): number | null => {
  const normalized = normalizeBubbleText(text);
  if (!normalized || maxBubbleWidth <= USER_BUBBLE_PADDING_X) return null;
  const maxTextWidth = Math.max(1, maxBubbleWidth - USER_BUBBLE_PADDING_X);
  const prepared = prepareWithSegments(normalized, USER_BUBBLE_FONT, {
    whiteSpace: "pre-wrap",
  });
  const targetLineCount = measureLineStats(prepared, maxTextWidth).lineCount;
  if (targetLineCount === 0) return null;

  let low = USER_BUBBLE_MIN_TEXT_WIDTH;
  let high = maxTextWidth;
  while (high - low > SHRINKWRAP_PRECISION_PX) {
    const mid = (low + high) / 2;
    const { lineCount } = measureLineStats(prepared, mid);
    if (lineCount <= targetLineCount) high = mid;
    else low = mid;
  }

  return Math.ceil(high) + USER_BUBBLE_PADDING_X;
};
