import { useStdout } from "ink";

const DEFAULT_COLS = 80;
const MAX_COLS = 10_000;

/**
 * Safe column count for Ink `Box` `width`. Yoga (WASM) can throw if width is 0
 * or invalid; `stdout.columns` is sometimes 0 briefly or in broken pipes.
 */
export function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const c = stdout.columns;
  const raw =
    typeof c === "number" && Number.isFinite(c) && c >= 0 ? c : DEFAULT_COLS;
  return Math.max(1, Math.min(raw || DEFAULT_COLS, MAX_COLS));
}
