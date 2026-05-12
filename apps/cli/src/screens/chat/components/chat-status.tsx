import type { ReactNode } from "react";
import { Text } from "ink";

import { Loading } from "~/components/index.js";
import { semantic } from "~/theme/semantic.js";

export type ChatPhase = "idle" | "thinking" | "narrating" | "speaking";
export type SttPhase = "idle" | "recording" | "transcribing";

export interface ChatStatusProps {
  chatPhase: ChatPhase;
  sttPhase: SttPhase;
  hasStreamingResponse: boolean;
  isChatPending: boolean;
  messageCount: number;
  sttError: Error | null;
  chatError: Error | null;
  activeToolCall?: string | null;
}

const isAbortError = (err: Error) =>
  err.name === "AbortError" || err.message?.toLowerCase().includes("abort");

function renderChatErrorBlock(p: ChatStatusProps) {
  const msg = p.chatError!.message;
  const isModelNotFound =
    /not found|unknown model|model .* does not exist/i.test(msg);
  return (
    <Text color={semantic.error}>
      {msg}
      {isModelNotFound
        ? " — Check Settings: Chat provider (Ollama vs OpenRouter) and Chat model."
        : ""}
    </Text>
  );
}

type StatusRule = {
  readonly when: (p: ChatStatusProps) => boolean;
  readonly render: (p: ChatStatusProps) => ReactNode;
};

/** First matching rule wins (explicit priority order). */
const CHAT_STATUS_RULES: readonly StatusRule[] = [
  {
    when: (p) => p.isChatPending && !!p.activeToolCall,
    render: (p) => (
      <Text color={semantic.accent}>Calling tool: {p.activeToolCall}…</Text>
    ),
  },
  {
    when: (p) =>
      p.isChatPending && p.chatPhase === "thinking" && !p.hasStreamingResponse,
    render: () => <Loading message="Thinking…" />,
  },
  {
    when: (p) => p.isChatPending && p.chatPhase === "narrating",
    render: () => <Loading message="Narrating…" />,
  },
  {
    when: (p) => p.isChatPending && p.chatPhase === "speaking",
    render: () => <Loading message="Speaking…" />,
  },
  {
    when: (p) => p.sttPhase === "recording",
    render: () => (
      <Text color={semantic.notice}>Recording… Press ctrl+t to stop.</Text>
    ),
  },
  {
    when: (p) => p.sttPhase === "transcribing",
    render: () => <Loading message="Transcribing…" />,
  },
  {
    when: (p) => !!p.sttError,
    render: (p) => (
      <Text color={semantic.error}>STT: {p.sttError!.message}</Text>
    ),
  },
  {
    when: (p) => !!p.chatError && !isAbortError(p.chatError!),
    render: renderChatErrorBlock,
  },
  {
    when: (p) => !!p.chatError && isAbortError(p.chatError!),
    render: () => <Text dimColor>Cancelled.</Text>,
  },
  {
    when: (p) =>
      p.messageCount === 0 && !p.hasStreamingResponse && !p.isChatPending,
    render: () => (
      <Text dimColor>
        Type or ctrl+t for voice — assistant replies are spoken with TTS.
      </Text>
    ),
  },
  {
    when: (p) =>
      !p.isChatPending &&
      p.sttPhase === "idle" &&
      !p.sttError &&
      !(p.chatError && !isAbortError(p.chatError)) &&
      p.messageCount > 0 &&
      !p.hasStreamingResponse,
    render: () => (
      <Text dimColor>
        Ready — Enter sends · ctrl+t voice · Esc back · /quit exit
      </Text>
    ),
  },
];

export function ChatStatus(props: ChatStatusProps) {
  const rule = CHAT_STATUS_RULES.find((r) => r.when(props));
  return rule ? rule.render(props) : null;
}
