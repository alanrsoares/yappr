import { useWindowSize } from "ink";

const DEFAULT_COLS = 80;
const MAX_COLS = 10_000;
const DEFAULT_ROWS = 24;
const MAX_ROWS = 10_000;

/**
 * Safe column count for Ink `Box` `width`. Yoga (WASM) can throw if width is 0
 * or invalid; `columns` is sometimes 0 briefly or in broken pipes.
 */
export function useTerminalWidth() {
  const { columns } = useWindowSize();
  const raw =
    typeof columns === "number" && Number.isFinite(columns) && columns >= 0
      ? columns
      : DEFAULT_COLS;
  return Math.max(1, Math.min(raw || DEFAULT_COLS, MAX_COLS));
}

/**
 * Safe row count for Ink `Box` `height` / `height="100%"` ancestors. Same failure
 * mode as {@link useTerminalWidth} when `rows` is 0 or missing.
 */
export function useTerminalHeight() {
  const { rows } = useWindowSize();
  const raw =
    typeof rows === "number" && Number.isFinite(rows) && rows >= 0
      ? rows
      : DEFAULT_ROWS;
  return Math.max(1, Math.min(raw || DEFAULT_ROWS, MAX_ROWS));
}
