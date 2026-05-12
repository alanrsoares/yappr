import { useCallback, useRef, useState } from "react";

import { createContainer } from "@yappr/lib/unstated";
import { okAsync } from "neverthrow";

import { buildChatFooterItems } from "~/footer-items.js";
import { useMutation, usePreferences, useVoiceToggle } from "~/hooks";
import { appendMessage, createConversation } from "~/lib/chat-persistence.js";
import { quit } from "~/quit.js";
import {
  chat,
  narrateResponse,
  recordAndTranscribe,
  speak,
} from "~/services/yappr";
import type { ChatMessage, ScreenId } from "~/types.js";
import {
  ChatStatus,
  type ChatPhase,
  type SttPhase,
} from "./components/chat-status.js";
import {
  resolveSlashSubmit,
  type SlashCommandContext,
} from "./slash-commands.js";

export interface ChatStoreInitialState {
  onBack: () => void;
  onNavigate?: (screen: ScreenId) => void;
}

function useChatStoreLogic(initialState?: ChatStoreInitialState) {
  const noop = useCallback(() => {}, []);
  const onBack = initialState?.onBack ?? noop;
  const onNavigate = initialState?.onNavigate;

  const [value, setValue] = useState("");
  const [slashNotice, setSlashNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Active conversation id. Lazily created on the first user prompt so a
  // session that never sends anything doesn't leave an empty row behind.
  // `/clear` resets to null, starting a fresh conversation on the next send.
  const conversationIdRef = useRef<string | null>(null);

  const { preferences } = usePreferences();
  const {
    ollamaBaseUrl,
    mcpConfigPath,
    defaultChatProvider: provider,
    defaultChatModel: model,
    openrouterApiKey,
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

    // Persist the user turn. First prompt of a session lazily creates the
    // conversation row (titled from the prompt). Persistence failures are
    // logged but don't block the chat — the in-memory transcript still
    // renders so the user can keep working.
    const userMessage: ChatMessage = { role: "user", content: prompt };
    const persistUser = (async () => {
      if (!conversationIdRef.current) {
        const created = await createConversation(prompt, model);
        created.match(
          (conv) => {
            conversationIdRef.current = conv.id;
          },
          (err) => console.warn("[yappr] failed to persist conversation:", err),
        );
      }
      const convId = conversationIdRef.current;
      if (!convId) return;
      const result = await appendMessage(convId, userMessage);
      result.match(
        () => undefined,
        (err) => console.warn("[yappr] failed to persist user message:", err),
      );
    })();
    void persistUser;

    return chat(prompt, {
      provider,
      model,
      ollamaBaseUrl,
      openrouterApiKey,
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
            provider: narrationModel ? "ollama" : provider,
            ollamaBaseUrl,
            openrouterApiKey: narrationModel ? undefined : openrouterApiKey,
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
        // Persist the assistant turn alongside the user one. Fire-and-forget
        // — UI is already updated, DB is just the durable shadow.
        if (res !== null) {
          const convId = conversationIdRef.current;
          if (convId) {
            void appendMessage(convId, {
              role: "assistant",
              content: res,
            }).then((result) =>
              result.match(
                () => undefined,
                (err) =>
                  console.warn(
                    "[yappr] failed to persist assistant message:",
                    err,
                  ),
              ),
            );
          }
        }
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

  const clearConversation = useCallback(() => {
    stopChat();
    stopStt();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setHasStoppedRecording(false);
    chatMutation.reset();
    sttMutation.reset();
    setMessages([]);
    setStreamingResponse("");
    setPhase("idle");
    setActiveToolCall(null);
    // Detach from the current conversation row — next send will start a new
    // one. The previous conversation stays in the DB for browsing later.
    conversationIdRef.current = null;
  }, [stopChat, stopStt, chatMutation, sttMutation]);

  const { isLeakage } = useVoiceToggle({
    isRecording: sttPhase === "recording",
    onStart: startStt,
    onStop: stopStt,
    onValueChange: setValue,
  });

  const handleInputChange = useCallback(
    (val: string) => {
      setSlashNotice(null);
      if (!isLeakage(val, value)) setValue(val);
    },
    [isLeakage, value],
  );

  const quitApp = useCallback(() => {
    stopStt();
    stopChat();
    quit();
  }, [stopStt, stopChat]);

  const buildSlashContext = useCallback((): SlashCommandContext => {
    return {
      clearConversation,
      stopChat,
      stopStt,
      quitApp,
      onBack,
      navigate: (screen) => {
        if (onNavigate) onNavigate(screen);
        else
          setSlashNotice(
            `Open ${screen} from the main menu (this build has no navigator).`,
          );
      },
      showNotice: setSlashNotice,
      model,
      provider,
      voice,
      useNarrationForTTS,
    };
  }, [
    clearConversation,
    stopChat,
    stopStt,
    quitApp,
    onBack,
    onNavigate,
    model,
    provider,
    voice,
    useNarrationForTTS,
  ]);

  const handleComposerSubmit = useCallback(
    (raw: string, slashPick?: string) => {
      const t = raw.trim();
      if (!t) return;
      if (t.startsWith("/")) {
        const body = t.slice(1).trim();
        if (!body && !slashPick) {
          setSlashNotice(
            "Type to filter · ↑↓ select · Enter run · /help lists all",
          );
          return;
        }
        const def = resolveSlashSubmit(t, slashPick);
        if (def) {
          sttMutation.reset();
          def.run(buildSlashContext());
          setValue("");
          return;
        }
        setSlashNotice(`Unknown command: ${t}. Try /help.`);
        setValue("");
        return;
      }
      sttMutation.reset();
      chatMutation.mutate(t);
      setValue("");
    },
    [buildSlashContext, chatMutation, sttMutation],
  );

  const dismissSlashOrBack = useCallback(() => {
    setSlashNotice(null);
    if (value.startsWith("/")) {
      setValue("");
      return;
    }
    onBack();
  }, [value, onBack]);

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

  const isSlashPalette = value.startsWith("/");

  const state = {
    provider,
    model,
    voice,
    useNarrationForTTS,
    value,
    messages,
    streamingResponse,
    statusContent,
    slashNotice,
    footerItems: buildChatFooterItems({
      isSlashPalette,
      isChatPending: chatMutation.isPending,
      hasComposerValue: !!value.trim(),
    }),
  };

  const actions = {
    onBack,
    dismissSlashOrBack,
    handleInputChange,
    handleComposerSubmit,
    stopStt,
    stopChat,
  };

  return [state, actions] as const;
}

export const { useContainer: useChatStore, Provider: ChatProvider } =
  createContainer<ReturnType<typeof useChatStoreLogic>, ChatStoreInitialState>(
    useChatStoreLogic,
  );
