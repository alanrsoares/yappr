import { useCallback, useRef, useState } from "react";

import { okAsync } from "neverthrow";

import { useMutation, usePreferences, useVoiceToggle } from "~/cli/hooks";
import {
  chat,
  narrateResponse,
  recordAndTranscribe,
  speak,
} from "~/cli/services/yappr.js";
import type { ChatMessage } from "~/cli/types.js";
import { createContainer } from "~/lib/unstated.js";
import {
  ChatStatus,
  type ChatPhase,
  type SttPhase,
} from "./components/chat-status.js";

export interface ChatStoreInitialState {
  onBack: () => void;
}

function useChatStoreLogic(initialState?: ChatStoreInitialState) {
  const onBack = initialState?.onBack ?? (() => {});

  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  const { preferences } = usePreferences();
  const {
    ollamaBaseUrl,
    mcpConfigPath,
    defaultOllamaModel: model,
    defaultVoice: voice,
    useNarrationForTTS,
    narrationModel,
  } = preferences;

  const chatMutation = useMutation<string | null, Error, string>((prompt) => {
    setPhase("thinking");
    setStreamingResponse("");
    setActiveToolCall(null);
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    chatAbortRef.current = new AbortController();
    const priorMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    return chat(prompt, {
      model,
      ollamaBaseUrl,
      mcpConfigPath,
      messages: priorMessages,
      onUpdate: (text) => setStreamingResponse(text),
      abortController: chatAbortRef.current,
      onToolCall: (name, phase) => {
        setActiveToolCall(phase === "start" ? name : null);
      },
    })
      .andThen((text) => {
        if (!text) return okAsync(null);
        const modelForNarration = narrationModel || model;
        if (useNarrationForTTS && modelForNarration) {
          setPhase("narrating");
          return narrateResponse(text, {
            model: modelForNarration,
            ollamaBaseUrl,
          })
            .map((narration) => narration.trim() || text)
            .andThen((toSpeak) => {
              setPhase("speaking");
              return speak(toSpeak, { voice }).map(() => text);
            });
        }
        setPhase("speaking");
        return speak(text, { voice }).map(() => text);
      })
      .map((res) => {
        setPhase("idle");
        setMessages((prev) =>
          res !== null ? [...prev, { role: "assistant", content: res }] : prev,
        );
        setStreamingResponse("");
        return res;
      })
      .mapErr((err) => {
        setPhase("idle");
        setStreamingResponse("");
        setActiveToolCall(null);
        return err;
      });
  });

  const stopChat = useCallback(() => {
    if (chatAbortRef.current && chatMutation.isPending) {
      chatAbortRef.current.abort();
    }
  }, [chatMutation.isPending]);

  const sttMutation = useMutation<string, Error, AbortSignal>(
    (signal) =>
      recordAndTranscribe({
        deviceIndex: preferences.defaultInputDeviceIndex,
        recordSignal: signal,
      }),
    {
      onSuccess: (transcript) => {
        if (transcript)
          setValue((p) => (p ? `${p} ${transcript}` : transcript));
      },
    },
  );

  const sttPhase: SttPhase = !sttMutation.isPending
    ? "idle"
    : hasStoppedRecording
      ? "transcribing"
      : "recording";

  const startStt = useCallback(() => {
    if (chatMutation.isPending || sttMutation.isPending) return;
    sttMutation.reset();
    setHasStoppedRecording(false);
    abortRef.current = new AbortController();
    sttMutation.mutate(abortRef.current.signal);
  }, [chatMutation.isPending, sttMutation]);

  const stopStt = useCallback(() => {
    if (abortRef.current && sttPhase === "recording") {
      abortRef.current.abort();
      setHasStoppedRecording(true);
    }
  }, [sttPhase]);

  const { isLeakage } = useVoiceToggle({
    isRecording: sttPhase === "recording",
    onStart: startStt,
    onStop: stopStt,
    onValueChange: setValue,
  });

  const handleInputChange = useCallback(
    (val: string) => {
      if (!isLeakage(val, value)) setValue(val);
    },
    [isLeakage, value],
  );

  const handleSubmit = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      sttMutation.reset();
      chatMutation.mutate(prompt.trim());
      setValue("");
    },
    [chatMutation, sttMutation],
  );

  const statusContent = (
    <ChatStatus
      chatPhase={phase}
      sttPhase={sttPhase}
      hasStreamingResponse={!!streamingResponse}
      isChatPending={chatMutation.isPending}
      messageCount={messages.length}
      sttError={sttMutation.error ?? null}
      chatError={chatMutation.error ?? null}
      activeToolCall={activeToolCall}
    />
  );

  const showStatusLine =
    statusContent !== null ||
    (chatMutation.isPending && !!streamingResponse) ||
    (chatMutation.isPending && phase === "thinking") ||
    (chatMutation.isPending && phase === "narrating") ||
    (chatMutation.isPending && phase === "speaking") ||
    (chatMutation.isPending && !!activeToolCall) ||
    sttPhase !== "idle" ||
    sttMutation.error !== undefined ||
    chatMutation.isError;

  const state = {
    model,
    voice,
    useNarrationForTTS,
    value,
    messages,
    streamingResponse,
    statusContent,
    showStatusLine,
    footerItems: [
      { key: "ctrl+t", label: "voice" },
      { key: "Esc", label: "back" },
      { key: "q", label: "quit" },
      ...(chatMutation.isPending ? [{ key: "ctrl+c", label: "stop" }] : []),
      ...(value.trim() ? [{ key: "Enter", label: "submit" }] : []),
    ],
  };

  const actions = {
    onBack,
    handleInputChange,
    handleSubmit,
    /** Abort in-flight voice recording so quit can exit cleanly. */
    stopStt,
    /** Abort in-flight chat generation. */
    stopChat,
  };

  return [state, actions] as const;
}

export const { useContainer: useChatStore, Provider: ChatProvider } =
  createContainer<ReturnType<typeof useChatStoreLogic>, ChatStoreInitialState>(
    useChatStoreLogic,
  );
