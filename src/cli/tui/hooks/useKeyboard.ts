import { useInput } from "ink";

export interface KeyBinding {
  keys: string[];
  action: () => void;
}

export interface UseKeyboardOptions {
  bindings: KeyBinding[];
}

function getEffectiveKey(input: string, key: { escape?: boolean; return?: boolean; upArrow?: boolean; downArrow?: boolean }): string {
  if (key.escape) return "escape";
  if (key.return) return "return";
  if (key.upArrow) return "upArrow";
  if (key.downArrow) return "downArrow";
  return input;
}

/**
 * Composable keyboard handler. Each binding maps a list of keys to an action.
 * Keys: chars ("q", "k", "j"), "escape", "return", "upArrow", "downArrow".
 * "enter" is treated as "return".
 */
export function useKeyboard({ bindings }: UseKeyboardOptions): void {
  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key);
    for (const { keys, action } of bindings) {
      if (keys.includes(effectiveKey) || (effectiveKey === "return" && keys.includes("enter"))) {
        action();
        return;
      }
    }
  });
}
