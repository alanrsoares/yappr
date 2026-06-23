import {
  type LayoutLine,
  layoutWithLines,
  type PreparedTextWithSegments,
  prepareWithSegments,
} from "@chenglou/pretext";

export const CAPTION_FONT_FAMILY =
  '"JetBrains Mono", Menlo, Monaco, Consolas, monospace';
export const CAPTION_FONT_SIZE = 18;
export const CAPTION_FONT_WEIGHT = 600;
export const CAPTION_LINE_HEIGHT = 28;
export const CAPTION_FONT = `${CAPTION_FONT_WEIGHT} ${CAPTION_FONT_SIZE}px ${CAPTION_FONT_FAMILY}`;

export type PreparedCaption = {
  text: string;
  prepared: PreparedTextWithSegments;
};

export type CaptionLayoutLine = LayoutLine & {
  weight: number;
};

export type CaptionLayout = {
  lines: CaptionLayoutLine[];
  activeLineIndex: number;
  height: number;
  lineCount: number;
};

const clampProgress = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const lineWeight = (text: string): number => {
  const length = [...text.trim()].length;
  return length > 0 ? length : 1;
};

const activeLineIndexFor = (
  lines: readonly CaptionLayoutLine[],
  progress: number,
): number => {
  if (lines.length === 0) return -1;
  const totalWeight = lines.reduce((sum, line) => sum + line.weight, 0);
  const target = clampProgress(progress) * totalWeight;
  let cursor = 0;
  for (const [i, line] of lines.entries()) {
    cursor += line?.weight ?? 0;
    if (target <= cursor) return i;
  }
  return lines.length - 1;
};

export const normalizeCaptionText = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const prepareCaption = (text: string): PreparedCaption | null => {
  const normalized = normalizeCaptionText(text);
  if (!normalized) return null;
  return {
    text: normalized,
    prepared: prepareWithSegments(normalized, CAPTION_FONT, {
      whiteSpace: "pre-wrap",
    }),
  };
};

export const layoutCaption = (
  caption: PreparedCaption,
  maxWidth: number,
  progress: number,
): CaptionLayout => {
  const width = Math.max(1, maxWidth);
  const layout = layoutWithLines(caption.prepared, width, CAPTION_LINE_HEIGHT);
  const lines = layout.lines.map((line) => ({
    ...line,
    weight: lineWeight(line.text),
  }));
  return {
    lines,
    activeLineIndex: activeLineIndexFor(lines, progress),
    height: layout.height,
    lineCount: layout.lineCount,
  };
};
