/** Cyclic list index: `delta` is −1 / +1 for up/down. */
export function cycleIndex(index: number, length: number, delta: number) {
  if (length <= 0) return 0;
  return (index + length + delta) % length;
}

/** Clamp raw selection to `[0, length − 1]`; `0` if list empty. */
export function clampSelectedIndex(selectedIndex: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, selectedIndex), length - 1);
}
