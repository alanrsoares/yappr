/** Cyclic list index: `delta` is −1 / +1 for up/down. */
export const cycleIndex = (index: number, length: number, delta: number) =>
  length <= 0 ? 0 : (index + length + delta) % length;

/** Clamp raw selection to `[0, length − 1]`; `0` if list empty. */
export const clampSelectedIndex = (selectedIndex: number, length: number) =>
  length <= 0 ? 0 : Math.min(Math.max(0, selectedIndex), length - 1);
