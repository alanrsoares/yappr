import { Text, useInput } from "ink";

export interface CursorTextInputProps {
  value: string;
  cursor: number;
  onChange: (value: string, cursor: number) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
}

/**
 * Controlled text input that exposes cursor position so callers can insert
 * content at the caret (e.g. pasted image tokens). Mirrors ink-text-input's
 * basic editing behaviour without owning cursor state internally.
 *
 * Bracketed-paste / multi-char chunks are inserted at cursor in one shot.
 */
export function CursorTextInput({
  value,
  cursor,
  onChange,
  onSubmit,
  placeholder = "",
  focus = true,
}: CursorTextInputProps) {
  const clampedCursor = Math.min(Math.max(cursor, 0), value.length);

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(value);
        return;
      }
      if (key.leftArrow) {
        onChange(value, Math.max(0, clampedCursor - 1));
        return;
      }
      if (key.rightArrow) {
        onChange(value, Math.min(value.length, clampedCursor + 1));
        return;
      }
      if (key.backspace || key.delete) {
        if (clampedCursor === 0) return;
        const next =
          value.slice(0, clampedCursor - 1) + value.slice(clampedCursor);
        onChange(next, clampedCursor - 1);
        return;
      }
      if (key.ctrl && input === "a") {
        onChange(value, 0);
        return;
      }
      if (key.ctrl && input === "e") {
        onChange(value, value.length);
        return;
      }
      if (key.ctrl && input === "k") {
        onChange(value.slice(0, clampedCursor), clampedCursor);
        return;
      }
      if (key.ctrl && input === "u") {
        onChange(value.slice(clampedCursor), 0);
        return;
      }
      if (!input || key.ctrl || key.meta) return;
      const next =
        value.slice(0, clampedCursor) + input + value.slice(clampedCursor);
      onChange(next, clampedCursor + input.length);
    },
    { isActive: focus },
  );

  if (value.length === 0) {
    return placeholder ? (
      <Text>
        <Text inverse> </Text>
        <Text dimColor>{placeholder}</Text>
      </Text>
    ) : (
      <Text inverse> </Text>
    );
  }

  const before = value.slice(0, clampedCursor);
  const cursorChar = value.slice(clampedCursor, clampedCursor + 1) || " ";
  const after = value.slice(clampedCursor + 1);
  return (
    <Text>
      {before}
      <Text inverse>{cursorChar}</Text>
      {after}
    </Text>
  );
}
