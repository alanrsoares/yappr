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
  status: "success" | "error";
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
  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function deriveMessages(events: readonly ChatEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const streamingByMessageId = new Map<string, string>();
  const finalizedMessageIds = new Set<string>();

  for (const event of events) {
    if (event.type === "message.user") {
      messages.push({ role: "user", content: event.content });
    } else if (event.type === "message.assistant.streaming") {
      if (!finalizedMessageIds.has(event.messageId)) {
        const current = streamingByMessageId.get(event.messageId) ?? "";
        streamingByMessageId.set(event.messageId, current + event.delta);
      }
    } else if (event.type === "message.assistant") {
      finalizedMessageIds.add(event.messageId);
      streamingByMessageId.delete(event.messageId);
      if (event.content) {
        messages.push({ role: "assistant", content: event.content });
      }
    }
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
        streamingByMessageId.set(event.messageId, current + event.delta);
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
    if (event.type === "tool.call") {
      open.set(event.toolCallId, event.name);
    } else if (event.type === "tool.result") {
      open.delete(event.toolCallId);
    } else if (event.type === "run.end") {
      open.clear();
    }
  }

  const latest = Array.from(open.values()).at(-1);
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
    if (event.type === "tool.call") {
      summaries.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        name: event.name,
        status: "running",
      });
    } else if (event.type === "tool.result") {
      summaries.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        name: event.name,
        status: event.error ? "error" : "done",
        elapsedMs: event.elapsedMs,
        error: event.error,
      });
    }
  }

  return Array.from(summaries.values());
}

export function deriveChatPhase(events: readonly ChatEvent[]): ChatPhase {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event) continue;
    if (event.type === "tts.end" || event.type === "run.end") return "idle";
    if (event.type === "tts.start") {
      return event.mode === "narration" ? "narrating" : "speaking";
    }
    if (
      event.type === "run.start" ||
      event.type === "tool.call" ||
      event.type === "tool.result" ||
      event.type === "message.assistant.streaming"
    ) {
      return "thinking";
    }
  }

  return "idle";
}
