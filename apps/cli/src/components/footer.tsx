import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";

import { semantic } from "~/theme/semantic.js";

const ARROW_UP = "↑";
const ARROW_DOWN = "↓";
const ARROW_KEY_SPLIT = /(↑|↓)/;
const ARROW_PULSE_MS = 320;

export interface FooterItem {
  key: string;
  label: string;
}

export interface FooterProps {
  items: FooterItem[];
  marginTop?: number;
}

type ArrowPulse = "up" | "down" | null;

const footerKeyHasArrows = (keyText: string) =>
  keyText.includes(ARROW_UP) || keyText.includes(ARROW_DOWN);

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

function FooterKeyCell(props: { item: FooterItem; pulse: ArrowPulse }) {
  const { item, pulse } = props;
  return !footerKeyHasArrows(item.key) ? (
    <Text bold color={semantic.accent}>
      {item.key}
    </Text>
  ) : (
    item.key
      .split(ARROW_KEY_SPLIT)
      .filter((p) => p.length > 0)
      .map((part, j) => (
        <FooterKeyPart
          key={`${item.key}-${j}-${part}`}
          part={part}
          pulse={pulse}
        />
      ))
  );
}

export function Footer({ items, marginTop = 1 }: FooterProps) {
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
    <Box marginTop={marginTop} flexDirection="row" flexWrap="wrap">
      {items.map((item, i) => (
        <Box key={`${i}-${item.key}-${item.label}`} flexDirection="row">
          <FooterKeyCell item={item} pulse={arrowPulse} />
          <Text dimColor> {item.label}</Text>
          {i < items.length - 1 && <Text dimColor> · </Text>}
        </Box>
      ))}
    </Box>
  );
}
