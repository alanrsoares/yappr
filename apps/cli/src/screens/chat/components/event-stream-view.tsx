import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";

import {
  getEffectiveKey,
  type ExtendedKey,
  type InkKeyWithAlt,
} from "~/hooks/index.js";
import { clampSelectedIndex, cycleIndex } from "~/list-nav.js";
import { truncateDisplayWidth } from "~/string-display.js";
import { semantic } from "~/theme/semantic.js";
import type { ChatEvent } from "../events.js";

const EVENT_FILTERS = [
  "all",
  "messages",
  "tools",
  "audio",
  "errors",
  "system",
] as const;

type EventFilter = (typeof EVENT_FILTERS)[number];

const MAX_VISIBLE_EVENTS = 15;
const DETAIL_MAX_LINES = 10;

const isMessageEvent = (event: ChatEvent) => event.type.startsWith("message.");

const isToolEvent = (event: ChatEvent) => event.type.startsWith("tool.");

const isAudioEvent = (event: ChatEvent) =>
  event.type.startsWith("tts.") || event.type.startsWith("stt.");

const isErrorEvent = (event: ChatEvent) =>
  ("error" in event && Boolean(event.error)) ||
  (event.type === "system" && event.level === "error") ||
  (event.type === "run.end" && event.status === "error");

function eventMatchesFilter(event: ChatEvent, filter: EventFilter) {
  if (filter === "all") return true;
  if (filter === "messages") return isMessageEvent(event);
  if (filter === "tools") return isToolEvent(event);
  if (filter === "audio") return isAudioEvent(event);
  if (filter === "errors") return isErrorEvent(event);
  return event.type === "system";
}

function formatClock(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function previewText(value: string, width: number) {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return truncateDisplayWidth(singleLine, width);
}

function summarizeEvent(event: ChatEvent, width: number) {
  const detailWidth = Math.max(12, width - 38);
  switch (event.type) {
    case "run.start":
      return `${event.model} / ${event.provider}`;
    case "run.end":
      return `${event.status} ${event.elapsedMs}ms${event.error ? ` ${previewText(event.error, detailWidth)}` : ""}`;
    case "message.user":
      return previewText(event.content, detailWidth);
    case "message.assistant.streaming":
      return `delta ${event.delta.length} chars`;
    case "message.assistant": {
      const ttft = event.ttftMs ? ` TTFT ${event.ttftMs}ms` : "";
      return `${event.content.length} chars${ttft} TTLT ${event.ttltMs ?? 0}ms`;
    }
    case "tool.call":
      return `${event.name} started`;
    case "tool.result":
      return `${event.name} ${event.error ? "error" : "done"} ${event.elapsedMs}ms`;
    case "tts.start":
      return `${event.mode} ${event.voice} ${event.contentLength} chars`;
    case "tts.end":
      return `${event.status} ${event.elapsedMs}ms`;
    case "stt.start":
      return `device ${event.deviceIndex}`;
    case "stt.transcript":
      return `${event.elapsedMs}ms ${previewText(event.content, detailWidth)}`;
    case "stt.end":
      return `${event.status} ${event.elapsedMs}ms`;
    case "system":
      return `${event.level} ${previewText(event.message, detailWidth)}`;
  }
}

function eventColor(event: ChatEvent) {
  if (isErrorEvent(event)) return semantic.error;
  if (event.type.endsWith(".end") || event.type === "tool.result")
    return semantic.success;
  if (event.type.endsWith(".start") || event.type === "tool.call")
    return semantic.accent;
  return undefined;
}

function eventDetailLines(event: ChatEvent) {
  return JSON.stringify(event, null, 2).split("\n").slice(0, DETAIL_MAX_LINES);
}

function nextEventFilter(current: EventFilter): EventFilter {
  const index = EVENT_FILTERS.indexOf(current);
  const nextIndex = cycleIndex(index, EVENT_FILTERS.length, 1);
  return EVENT_FILTERS[nextIndex] ?? EVENT_FILTERS[0];
}

export interface EventStreamViewProps {
  events: readonly ChatEvent[];
  width: number;
  onClose: () => void;
}

export function EventStreamView({
  events,
  width,
  onClose,
}: EventStreamViewProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatchesFilter(event, filter)),
    [events, filter],
  );
  const n = filteredEvents.length;
  const effectiveIndex = clampSelectedIndex(selectedIndex, n);
  const selectedEvent = filteredEvents[effectiveIndex];
  const windowStart =
    n <= MAX_VISIBLE_EVENTS
      ? 0
      : Math.min(Math.max(0, effectiveIndex - 6), n - MAX_VISIBLE_EVENTS);
  const visibleEvents = filteredEvents.slice(
    windowStart,
    windowStart + MAX_VISIBLE_EVENTS,
  );

  useInput((input, key) => {
    const effectiveKey = getEffectiveKey(input, key as ExtendedKey);
    if (effectiveKey === "escape") {
      onClose();
      return;
    }
    if (effectiveKey === "upArrow" || input === "k") {
      setSelectedIndex((i) => cycleIndex(i, n, -1));
      return;
    }
    if (effectiveKey === "downArrow" || input === "j") {
      setSelectedIndex((i) => cycleIndex(i, n, 1));
      return;
    }
    if (effectiveKey === "return") {
      setIsExpanded((current) => !current);
      return;
    }
    if (
      input === "f" &&
      !key.ctrl &&
      !key.meta &&
      !(key as InkKeyWithAlt).alt
    ) {
      setFilter(nextEventFilter);
      setSelectedIndex(0);
      setIsExpanded(false);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={semantic.accent} bold>
          Event Stream
        </Text>
        <Text dimColor>
          {" "}
          {events.length} events · filter {filter}
        </Text>
      </Box>

      {visibleEvents.length === 0 ? (
        <Text dimColor>No events for this filter.</Text>
      ) : (
        visibleEvents.map((event, i) => {
          const index = windowStart + i;
          const selected = index === effectiveIndex;
          const marker = selected ? "›" : " ";
          const line = `${marker} ${formatClock(event.timestamp)}  ${event.type.padEnd(28)} ${summarizeEvent(event, width)}`;
          return (
            <Text
              key={event.id}
              color={selected ? semantic.accent : eventColor(event)}
              bold={selected}
            >
              {truncateDisplayWidth(line, Math.max(24, width - 6))}
            </Text>
          );
        })
      )}

      {selectedEvent && isExpanded && (
        <Box flexDirection="column" marginTop={1}>
          {eventDetailLines(selectedEvent).map((line, i) => (
            <Text key={`${selectedEvent.id}-${i}`} dimColor>
              {truncateDisplayWidth(line, Math.max(24, width - 6))}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          ↑↓/j/k select · Enter details · f filter · Esc back
        </Text>
      </Box>
    </Box>
  );
}
