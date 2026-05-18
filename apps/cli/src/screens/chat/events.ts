import { match, P } from "ts-pattern";

import type { ChatMessage, ChatProvider } from "~/types.js";
import type { ChatPhase } from "./components/chat-status.js";

interface BaseChatEvent {
  id: string;
  runId: string;
  conversationId: string | null;
  timestamp: number;
}

export interface RunStartEvent extends BaseChatEvent {
  type: "run.start";
  provider: ChatProvider;
  model: string;
  voice: string;
  mcpConfigPath: string;
}

export interface RunEndEvent extends BaseChatEvent {
  type: "run.end";
  status: "success" | "error" | "cancelled";
  elapsedMs: number;
  error?: string;
}

export interface UserMessageEvent extends BaseChatEvent {
  type: "message.user";
  content: string;
}

export interface AssistantStreamingMessageEvent extends BaseChatEvent {
  type: "message.assistant.streaming";
  messageId: string;
  delta: string;
  isComplete: boolean;
  /** When true, `delta` replaces the accumulated text instead of being appended.
   *  Used when the provider replays content from the start mid-stream. */
  isReplace?: boolean;
}

export interface AssistantMessageEvent extends BaseChatEvent {
  type: "message.assistant";
  messageId: string;
  content: string;
  finishReason: "stop" | "empty" | "error" | "cancelled";
  ttftMs?: number;
  ttltMs?: number;
}

export interface ToolCallEvent extends BaseChatEvent {
  type: "tool.call";
  toolCallId: string;
  name: string;
  startTime: number;
}

export interface ToolResultEvent extends BaseChatEvent {
  type: "tool.result";
  toolCallId: string;
  name: string;
  elapsedMs: number;
  error?: string;
}

export interface TtsStartEvent extends BaseChatEvent {
  type: "tts.start";
  voice: string;
  mode: "direct" | "narration";
  contentLength: number;
}

export interface TtsEndEvent extends BaseChatEvent {
  type: "tts.end";
  status: "success" | "error" | "cancelled";
  elapsedMs: number;
  error?: string;
}

export interface SttStartEvent extends BaseChatEvent {
  type: "stt.start";
  deviceIndex: number;
}

export interface SttTranscriptEvent extends BaseChatEvent {
  type: "stt.transcript";
  content: string;
  elapsedMs: number;
}

export interface SttEndEvent extends BaseChatEvent {
  type: "stt.end";
  status: "success" | "cancelled" | "error";
  elapsedMs: number;
  error?: string;
}

export interface SystemEvent extends BaseChatEvent {
  type: "system";
  level: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export type ChatEvent =
  | RunStartEvent
  | RunEndEvent
  | UserMessageEvent
  | AssistantStreamingMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | TtsStartEvent
  | TtsEndEvent
  | SttStartEvent
  | SttTranscriptEvent
  | SttEndEvent
  | SystemEvent;

type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never;

export type ChatEventInput = DistributiveOmit<ChatEvent, "id" | "timestamp">;

export interface ToolCallSummary {
  toolCallId: string;
  name: string;
  status: "running" | "done" | "error";
  elapsedMs?: number;
  error?: string;
}

const randomId = () => crypto.randomUUID();

export const createRunId = () => `run_${randomId()}`;

export const createMessageId = () => `msg_${randomId()}`;

export const createToolCallId = (runId: string, name: string) =>
  `${runId}:tool:${name}:${randomId()}`;

export function createChatEvent(input: ChatEventInput): ChatEvent {
  return {
    id: randomId(),
    timestamp: Date.now(),
    ...input,
  } as ChatEvent;
}

export function appendChatEvent(
  events: ChatEvent[],
  event: ChatEvent,
  maxEvents = 500,
): ChatEvent[] {
  const next = [...events, event];
  return next.length > maxEvents ? next.slice(next.length - maxEvents) : next;
}

export function mergeChatEvents(
  localEvents: readonly ChatEvent[],
  persistedEvents: readonly ChatEvent[],
): ChatEvent[] {
  const byId = new Map<string, ChatEvent>();
  for (const event of persistedEvents) byId.set(event.id, event);
  for (const event of localEvents) byId.set(event.id, event);
  return [...byId.values()].toSorted((a, b) => a.timestamp - b.timestamp);
}

export function deriveMessages(events: readonly ChatEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const streamingByMessageId = new Map<string, string>();
  const finalizedMessageIds = new Set<string>();

  for (const event of events) {
    match(event)
      .with({ type: "message.user" }, (event) => {
        messages.push({ role: "user", content: event.content });
      })
      .with({ type: "message.assistant.streaming" }, (event) => {
        if (!finalizedMessageIds.has(event.messageId)) {
          const current = streamingByMessageId.get(event.messageId) ?? "";
          const next = event.isReplace ? event.delta : current + event.delta;
          streamingByMessageId.set(event.messageId, next);
        }
      })
      .with({ type: "message.assistant" }, (event) => {
        finalizedMessageIds.add(event.messageId);
        streamingByMessageId.delete(event.messageId);
        if (event.content) {
          messages.push({ role: "assistant", content: event.content });
        }
      })
      .otherwise(() => {});
  }

  return messages;
}

export function deriveStreamingResponse(events: readonly ChatEvent[]): string {
  const streamingByMessageId = new Map<string, string>();
  const finalizedMessageIds = new Set<string>();
  let latestMessageId: string | null = null;

  for (const event of events) {
    if (event.type === "message.assistant.streaming") {
      latestMessageId = event.messageId;
      if (!finalizedMessageIds.has(event.messageId)) {
        const current = streamingByMessageId.get(event.messageId) ?? "";
        const next = event.isReplace ? event.delta : current + event.delta;
        streamingByMessageId.set(event.messageId, next);
      }
    } else if (event.type === "message.assistant") {
      finalizedMessageIds.add(event.messageId);
      streamingByMessageId.delete(event.messageId);
    }
  }

  return latestMessageId
    ? (streamingByMessageId.get(latestMessageId) ?? "")
    : "";
}

export function deriveActiveToolCall(
  events: readonly ChatEvent[],
): string | null {
  const open = new Map<string, string>();

  for (const event of events) {
    match(event)
      .with({ type: "tool.call" }, (event) => {
        open.set(event.toolCallId, event.name);
      })
      .with({ type: "tool.result" }, (event) => {
        open.delete(event.toolCallId);
      })
      .with({ type: "run.end" }, () => {
        open.clear();
      })
      .otherwise(() => {});
  }

  const latest = [...open.values()].at(-1);
  return latest ?? null;
}

export function deriveLatestRunToolSummaries(
  events: readonly ChatEvent[],
): ToolCallSummary[] {
  const latestRunId = events.at(-1)?.runId;
  if (!latestRunId) return [];

  const summaries = new Map<string, ToolCallSummary>();
  for (const event of events) {
    if (event.runId !== latestRunId) continue;
    match(event)
      .with({ type: "tool.call" }, (event) => {
        summaries.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          name: event.name,
          status: "running",
        });
      })
      .with({ type: "tool.result" }, (event) => {
        summaries.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          name: event.name,
          status: event.error ? "error" : "done",
          elapsedMs: event.elapsedMs,
          error: event.error,
        });
      })
      .otherwise(() => {});
  }

  return [...summaries.values()];
}

export function deriveChatPhase(events: readonly ChatEvent[]): ChatPhase {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    const phase = match(event)
      .returnType<ChatPhase | null>()
      .with({ type: P.union("tts.end", "run.end") }, () => "idle")
      .with({ type: "tts.start", mode: "narration" }, () => "narrating")
      .with({ type: "tts.start", mode: "direct" }, () => "speaking")
      .with(
        {
          type: P.union(
            "run.start",
            "tool.call",
            "tool.result",
            "message.assistant.streaming",
          ),
        },
        () => "thinking",
      )
      .with(
        {
          type: P.union(
            "message.user",
            "message.assistant",
            "stt.start",
            "stt.transcript",
            "stt.end",
            "system",
          ),
        },
        () => null,
      )
      .exhaustive();
    if (phase) return phase;
  }

  return "idle";
}
