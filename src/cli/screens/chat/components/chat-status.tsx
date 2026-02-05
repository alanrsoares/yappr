import type { ReactNode } from "react";
import { Text } from "ink";

import { Loading } from "~/cli/components/index.js";

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
  /** When set, an MCP tool is currently being called (show "Calling &lt;name&gt;…"). */
  activeToolCall?: string | null;
}

function isAbortError(err: Error): boolean {
  return (
    err.name === "AbortError" || err.message?.toLowerCase().includes("abort")
  );
}

export function ChatStatus({
  chatPhase,
  sttPhase,
  hasStreamingResponse,
  isChatPending,
  messageCount,
  sttError,
  chatError,
  activeToolCall,
}: ChatStatusProps): ReactNode {
  if (isChatPending && activeToolCall) {
    return <Text color="cyan">Calling tool: {activeToolCall}…</Text>;
  }
  if (isChatPending && chatPhase === "thinking" && !hasStreamingResponse) {
    return <Loading message="Thinking…" />;
  }
  if (isChatPending && chatPhase === "narrating") {
    return <Loading message="Narrating…" />;
  }
  if (isChatPending && chatPhase === "speaking") {
    return <Loading message="Speaking…" />;
  }
  if (sttPhase === "recording") {
    return <Text color="yellow">Recording… Press ctrl+t to stop.</Text>;
  }
  if (sttPhase === "transcribing") {
    return <Loading message="Transcribing…" />;
  }
  if (sttError) {
    return <Text color="red">STT: {sttError.message}</Text>;
  }
  if (chatError && !isAbortError(chatError)) {
    const msg = chatError.message;
    const isModelNotFound =
      /not found|unknown model|model .* does not exist/i.test(msg);
    return (
      <Text color="red">
        {msg}
        {isModelNotFound
          ? " — Check Settings: Chat provider (Ollama vs OpenRouter) and Chat model."
          : ""}
      </Text>
    );
  }
  if (chatError && isAbortError(chatError)) {
    return <Text dimColor>Cancelled.</Text>;
  }
  if (messageCount === 0 && !hasStreamingResponse && !isChatPending) {
    return (
      <Text dimColor>
        Type or press ctrl+t for voice — reply is read aloud with TTS.
      </Text>
    );
  }
  return null;
}
