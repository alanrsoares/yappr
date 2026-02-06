import { useInput, type Key } from "ink";

export interface KeyBinding {
  keys: string[];
  action: () => void;
}

export interface UseKeyboardOptions {
  bindings: KeyBinding[];
}

export type ExtendedKey = Key & {
  [K in `f${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`]?: boolean;
};

export function getEffectiveKey(input: string, key: ExtendedKey): string {
  if (key.escape) return "escape";
  if (key.return) return "return";
  if (key.upArrow) return "upArrow";
  if (key.downArrow) return "downArrow";
  if (key.tab) return "tab";
  if (key.backspace) return "backspace";
  if (key.delete) return "delete";

  const fKeys = [
    "f1",
    "f2",
    "f3",
    "f4",
    "f5",
    "f6",
    "f7",
    "f8",
    "f9",
    "f10",
    "f11",
    "f12",
  ] as const;

  for (const fKey of fKeys) {
    if (key[fKey]) return fKey;
  }

  if (key.ctrl && input) return `ctrl+${input.toLowerCase()}`;
  return input;
}

/**
 * Composable keyboard handler. Each binding maps a list of keys to an action.
 * Keys: chars ("q", "k", "j"), "escape", "return", "upArrow", "downArrow", "f1"..."f12", "ctrl+v", etc.
 * "enter" is treated as "return".
 */
export function useKeyboard({ bindings }: UseKeyboardOptions): void {
  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);
    for (const { keys, action } of bindings) {
      if (
        keys.includes(effectiveKey) ||
        (effectiveKey === "return" && keys.includes("enter"))
      ) {
        action();
        return;
      }
    }
  });
}
