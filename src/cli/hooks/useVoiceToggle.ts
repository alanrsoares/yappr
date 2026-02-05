import { useCallback, useRef } from "react";

import { useKeyboard } from "./useKeyboard";

interface UseVoiceToggleOptions {
  onStart: () => void;
  onStop: () => void;
  isRecording: boolean;
  onValueChange: (updater: (prev: string) => string) => void;
}

/**
 * Encapsulates the Talk hotkey (ctrl+t) logic, including character leakage prevention.
 */
export function useVoiceToggle({
  onStart,
  onStop,
  isRecording,
  onValueChange,
}: UseVoiceToggleOptions) {
  const lastToggleRef = useRef<number>(0);

  const toggle = useCallback(() => {
    lastToggleRef.current = Date.now();
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
    // Immediate cleanup if character 't' leaked into state
    onValueChange((prev) => (prev.endsWith("t") ? prev.slice(0, -1) : prev));
  }, [isRecording, onStart, onStop, onValueChange]);

  useKeyboard({
    bindings: [
      {
        keys: ["ctrl+t"],
        action: toggle,
      },
    ],
  });

  const isLeakage = useCallback((nextVal: string, currentVal: string) => {
    const now = Date.now();
    // Filter out 't' or control-T if it's added within 200ms of a toggle press
    return (
      now - lastToggleRef.current < 200 &&
      (nextVal.endsWith("t") || nextVal.endsWith("\x14")) &&
      nextVal.length === currentVal.length + 1
    );
  }, []);

  return { isLeakage };
}
