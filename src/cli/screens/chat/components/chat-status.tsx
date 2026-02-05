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
}

export function ChatStatus({
  chatPhase,
  sttPhase,
  hasStreamingResponse,
  isChatPending,
  messageCount,
  sttError,
  chatError,
}: ChatStatusProps): ReactNode {
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
  if (chatError) {
    return <Text color="red">{chatError.message}</Text>;
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
