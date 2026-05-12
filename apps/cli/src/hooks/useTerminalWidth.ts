import { useStdout } from "ink";

const DEFAULT_COLS = 80;
const MAX_COLS = 10_000;
const DEFAULT_ROWS = 24;
const MAX_ROWS = 10_000;

/**
 * Safe column count for Ink `Box` `width`. Yoga (WASM) can throw if width is 0
 * or invalid; `stdout.columns` is sometimes 0 briefly or in broken pipes.
 */
export function useTerminalWidth() {
  const { stdout } = useStdout();
  const c = stdout.columns;
  const raw =
    typeof c === "number" && Number.isFinite(c) && c >= 0 ? c : DEFAULT_COLS;
  return Math.max(1, Math.min(raw || DEFAULT_COLS, MAX_COLS));
}

/**
 * Safe row count for Ink `Box` `height` / `height="100%"` ancestors. Same failure
 * mode as {@link useTerminalWidth} when `stdout.rows` is 0 or missing.
 */
export function useTerminalHeight() {
  const { stdout } = useStdout();
  const r = stdout.rows;
  const raw =
    typeof r === "number" && Number.isFinite(r) && r >= 0 ? r : DEFAULT_ROWS;
  return Math.max(1, Math.min(raw || DEFAULT_ROWS, MAX_ROWS));
}
