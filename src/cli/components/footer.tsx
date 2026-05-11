import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

import { semantic } from "~/cli/theme/semantic.js";

const ARROW_UP = "↑";
const ARROW_DOWN = "↓";
const ARROW_KEY_SPLIT = /(↑|↓)/;
/** Long enough to read; arrows use strong green vs muted peer. */
const ARROW_PULSE_MS = 320;

export interface FooterItem {
  key: string;
  label: string;
}

export interface FooterProps {
  items: FooterItem[];
}

type ArrowPulse = "up" | "down" | null;

function footerKeyHasArrows(keyText: string) {
  return keyText.includes(ARROW_UP) || keyText.includes(ARROW_DOWN);
}

function FooterKeyPart(props: { part: string; pulse: ArrowPulse }) {
  const { part, pulse } = props;
  if (part === ARROW_UP) {
    const active = pulse === "up";
    const muted = pulse === "down";
    const color = active
      ? semantic.success
      : muted
        ? semantic.frame
        : semantic.accent;
    return (
      <Text bold inverse={active} color={color}>
        {ARROW_UP}
      </Text>
    );
  }
  if (part === ARROW_DOWN) {
    const active = pulse === "down";
    const muted = pulse === "up";
    const color = active
      ? semantic.success
      : muted
        ? semantic.frame
        : semantic.accent;
    return (
      <Text bold inverse={active} color={color}>
        {ARROW_DOWN}
      </Text>
    );
  }
  return (
    <Text bold color={semantic.accent}>
      {part}
    </Text>
  );
}

export function Footer({ items }: FooterProps) {
  const [arrowPulse, setArrowPulse] = useState<ArrowPulse>(null);
  const pulseClearRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const schedulePulseClear = useCallback(() => {
    if (pulseClearRef.current !== undefined) {
      clearTimeout(pulseClearRef.current);
    }
    pulseClearRef.current = setTimeout(() => {
      setArrowPulse(null);
      pulseClearRef.current = undefined;
    }, ARROW_PULSE_MS);
  }, []);

  useInput((_input, key) => {
    if (key.upArrow) {
      setArrowPulse("up");
      schedulePulseClear();
      return;
    }
    if (key.downArrow) {
      setArrowPulse("down");
      schedulePulseClear();
    }
  });

  useEffect(
    () => () => {
      if (pulseClearRef.current !== undefined) {
        clearTimeout(pulseClearRef.current);
      }
    },
    [],
  );

  return (
    <Box marginTop={1} flexDirection="row" flexWrap="wrap">
      {items.map((item, i) => (
        <Box key={`${i}-${item.key}-${item.label}`} flexDirection="row">
          <Text dimColor>
            {footerKeyHasArrows(item.key)
              ? item.key
                  .split(ARROW_KEY_SPLIT)
                  .filter((p) => p.length > 0)
                  .map((part, j) => (
                    <FooterKeyPart
                      key={`${item.key}-${j}-${part}`}
                      part={part}
                      pulse={arrowPulse}
                    />
                  ))
              : (
                  <Text bold color={semantic.accent}>
                    {item.key}
                  </Text>
                )}
            <Text> {item.label}</Text>
            {i < items.length - 1 && <Text> · </Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
