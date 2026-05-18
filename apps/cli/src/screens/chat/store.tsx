import { useCallback, useMemo, useRef, useState } from "react";

import { createContainer } from "@yappr/lib/unstated";
import { okAsync } from "neverthrow";

import { buildChatFooterItems } from "~/footer-items.js";
import { useMutation, usePreferences, useVoiceToggle } from "~/hooks";
import {
  appendMessage,
  createConversationSync,
} from "~/lib/chat-persistence.js";
import { quit } from "~/quit.js";
import {
  chat,
  narrateResponse,
  recordAndTranscribe,
  speak,
} from "~/services/yappr";
import type { ChatMessage, ScreenId } from "~/types.js";
import { ChatStatus, type SttPhase } from "./components/chat-status.js";
import {
  listPersistedChatEvents,
  persistChatEvent,
} from "./event-persistence.js";
import {
  appendChatEvent,
  createChatEvent,
  createMessageId,
  createRunId,
  createToolCallId,
  deriveActiveToolCall,
  deriveChatPhase,
  deriveLatestRunToolSummaries,
  deriveMessages,
  deriveStreamingResponse,
  mergeChatEvents,
  type ChatEvent,
  type ChatEventInput,
} from "./events.js";
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
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [isEventStreamOpen, setIsEventStreamOpen] = useState(false);
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const runStartedAtRef = useRef(0);
  const lastStreamingTextRef = useRef("");
  const firstTokenAtRef = useRef<number | null>(null);
  const ttsStartedAtRef = useRef<number | null>(null);
  const ttsModeRef = useRef<"direct" | "narration" | null>(null);
  const sttRunIdRef = useRef<string | null>(null);
  const sttStartedAtRef = useRef(0);
  const activeToolIdsRef = useRef(
    new Map<string, Array<{ id: string; startedAt: number }>>(),
  );

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

  const emit = useCallback((event: ChatEventInput) => {
    const created = createChatEvent(event);
    setEvents((prev) => appendChatEvent(prev, created));
    void persistChatEvent(created).match(
      () => {},
      (err) => console.warn("[yappr] failed to persist agent event:", err),
    );
  }, []);

  const messages = useMemo(() => deriveMessages(events), [events]);
  const streamingResponse = useMemo(
    () => deriveStreamingResponse(events),
    [events],
  );
  const activeToolCall = useMemo(() => deriveActiveToolCall(events), [events]);
  const toolSummaries = useMemo(
    () => deriveLatestRunToolSummaries(events),
    [events],
  );
  const phase = useMemo(() => deriveChatPhase(events), [events]);

  const chatMutation = useMutation<string | null, Error, string>((prompt) => {
    const runId = createRunId();
    const assistantMessageId = createMessageId();
    runStartedAtRef.current = Date.now();
    firstTokenAtRef.current = null;
    lastStreamingTextRef.current = "";
    activeToolIdsRef.current.clear();
    if (!conversationIdRef.current) {
      try {
        const created = createConversationSync(prompt, model);
        conversationIdRef.current = created.id;
      } catch (error) {
        console.warn("[yappr] failed to persist conversation:", error);
      }
    }
    emit({
      type: "run.start",
      runId,
      conversationId: conversationIdRef.current,
      provider,
      model,
      voice,
      mcpConfigPath,
    });
    emit({
      type: "message.user",
      runId,
      conversationId: conversationIdRef.current,
      content: prompt,
    });
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
      const convId = conversationIdRef.current;
      if (!convId) return;
      const result = await appendMessage(convId, userMessage);
      result.match(
        () => {},
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
      onUpdate: (text) => {
        if (firstTokenAtRef.current === null)
          firstTokenAtRef.current = Date.now();
        const previous = lastStreamingTextRef.current;
        const isReplace = !text.startsWith(previous);
        const delta = isReplace ? text : text.slice(previous.length);
        lastStreamingTextRef.current = text;
        if (!delta) return;
        emit({
          type: "message.assistant.streaming",
          runId,
          conversationId: conversationIdRef.current,
          messageId: assistantMessageId,
          delta,
          isComplete: false,
          ...(isReplace && { isReplace: true }),
        });
      },
      abortController: chatAbortRef.current,
      onToolCall: (name, phase) => {
        if (phase === "start") {
          const toolCallId = createToolCallId(runId, name);
          const startedAt = Date.now();
          const activeCalls = activeToolIdsRef.current.get(name) ?? [];
          activeToolIdsRef.current.set(name, [
            ...activeCalls,
            { id: toolCallId, startedAt },
          ]);
          emit({
            type: "tool.call",
            runId,
            conversationId: conversationIdRef.current,
            toolCallId,
            name,
            startTime: startedAt,
          });
          return;
        }
        const activeCalls = activeToolIdsRef.current.get(name) ?? [];
        const active = activeCalls.at(-1);
        if (!active) return;
        const remaining = activeCalls.slice(0, -1);
        if (remaining.length > 0) activeToolIdsRef.current.set(name, remaining);
        else activeToolIdsRef.current.delete(name);
        emit({
          type: "tool.result",
          runId,
          conversationId: conversationIdRef.current,
          toolCallId: active.id,
          name,
          elapsedMs: Date.now() - active.startedAt,
        });
      },
    })
      .andThen((text) => {
        if (!text) return okAsync(null);
        const modelForNarration = narrationModel || model;
        const beginTtsPhase = (mode: "direct" | "narration") => {
          ttsStartedAtRef.current = Date.now();
          ttsModeRef.current = mode;
        };
        const endTtsPhase = (status: "success") => {
          const startedAt = ttsStartedAtRef.current ?? Date.now();
          ttsStartedAtRef.current = null;
          ttsModeRef.current = null;
          emit({
            type: "tts.end",
            runId,
            conversationId: conversationIdRef.current,
            status,
            elapsedMs: Date.now() - startedAt,
          });
        };
        if (useNarrationForTTS && modelForNarration) {
          beginTtsPhase("narration");
          emit({
            type: "tts.start",
            runId,
            conversationId: conversationIdRef.current,
            voice,
            mode: "narration",
            contentLength: text.length,
          });
          return narrateResponse(text, {
            model: modelForNarration,
            provider: narrationModel ? "ollama" : provider,
            ollamaBaseUrl,
            openrouterApiKey: narrationModel ? undefined : openrouterApiKey,
          })
            .map((narration) => narration.trim() || text)
            .andThen((toSpeak) => {
              endTtsPhase("success");
              beginTtsPhase("direct");
              emit({
                type: "tts.start",
                runId,
                conversationId: conversationIdRef.current,
                voice,
                mode: "direct",
                contentLength: toSpeak.length,
              });
              return speak(toSpeak, { voice }).map(() => {
                endTtsPhase("success");
                return text;
              });
            });
        }
        beginTtsPhase("direct");
        emit({
          type: "tts.start",
          runId,
          conversationId: conversationIdRef.current,
          voice,
          mode: "direct",
          contentLength: text.length,
        });
        return speak(text, { voice }).map(() => {
          endTtsPhase("success");
          return text;
        });
      })
      .map((res) => {
        const ttltMs = Date.now() - runStartedAtRef.current;
        if (res !== null) {
          emit({
            type: "message.assistant",
            runId,
            conversationId: conversationIdRef.current,
            messageId: assistantMessageId,
            content: res,
            finishReason: "stop",
            ...(firstTokenAtRef.current !== null && {
              ttftMs: firstTokenAtRef.current - runStartedAtRef.current,
            }),
            ttltMs,
          });
        }
        emit({
          type: "run.end",
          runId,
          conversationId: conversationIdRef.current,
          status: "success",
          elapsedMs: ttltMs,
        });
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
                () => {},
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
        const elapsedMs = Date.now() - runStartedAtRef.current;
        const status = err.name === "AbortError" ? "cancelled" : "error";
        if (ttsStartedAtRef.current !== null) {
          emit({
            type: "tts.end",
            runId,
            conversationId: conversationIdRef.current,
            status,
            elapsedMs: Date.now() - ttsStartedAtRef.current,
            error: err.message,
          });
          ttsStartedAtRef.current = null;
          ttsModeRef.current = null;
        }
        emit({
          type: "system",
          runId,
          conversationId: conversationIdRef.current,
          level: status === "cancelled" ? "info" : "error",
          message: err.message,
        });
        emit({
          type: "run.end",
          runId,
          conversationId: conversationIdRef.current,
          status,
          elapsedMs,
          error: err.message,
        });
        activeToolIdsRef.current.clear();
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
        const runId = sttRunIdRef.current;
        const elapsedMs = Date.now() - sttStartedAtRef.current;
        if (runId) {
          if (transcript) {
            emit({
              type: "stt.transcript",
              runId,
              conversationId: conversationIdRef.current,
              content: transcript,
              elapsedMs,
            });
          }
          emit({
            type: "stt.end",
            runId,
            conversationId: conversationIdRef.current,
            status: "success",
            elapsedMs,
          });
        }
        sttRunIdRef.current = null;
        if (transcript)
          setValue((p) => (p ? `${p} ${transcript}` : transcript));
      },
      onError: (err) => {
        const runId = sttRunIdRef.current;
        if (!runId) return;
        const status = err.name === "AbortError" ? "cancelled" : "error";
        emit({
          type: "stt.end",
          runId,
          conversationId: conversationIdRef.current,
          status,
          elapsedMs: Date.now() - sttStartedAtRef.current,
          error: err.message,
        });
        sttRunIdRef.current = null;
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
    const runId = createRunId();
    sttRunIdRef.current = runId;
    sttStartedAtRef.current = Date.now();
    emit({
      type: "stt.start",
      runId,
      conversationId: conversationIdRef.current,
      deviceIndex: preferences.defaultInputDeviceIndex,
    });
    sttMutation.mutate(abortRef.current.signal);
  }, [
    chatMutation.isPending,
    emit,
    preferences.defaultInputDeviceIndex,
    sttMutation,
  ]);

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
    setEvents([]);
    activeToolIdsRef.current.clear();
    lastStreamingTextRef.current = "";
    firstTokenAtRef.current = null;
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
      openEvents: () => {
        setSlashNotice(null);
        const convId = conversationIdRef.current;
        if (convId) {
          void listPersistedChatEvents(convId).match(
            (persistedEvents) =>
              setEvents((current) => mergeChatEvents(current, persistedEvents)),
            (err) =>
              console.warn("[yappr] failed to load persisted events:", err),
          );
        }
        setIsEventStreamOpen(true);
      },
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
    if (isEventStreamOpen) {
      setIsEventStreamOpen(false);
      return;
    }
    if (value.startsWith("/")) {
      setValue("");
      return;
    }
    onBack();
  }, [isEventStreamOpen, value, onBack]);

  const statusContent = (
    <ChatStatus
      chatPhase={phase}
      sttPhase={sttPhase}
      hasStreamingResponse={Boolean(streamingResponse)}
      isChatPending={chatMutation.isPending}
      messageCount={messages.length}
      sttError={sttMutation.error ?? null}
      chatError={chatMutation.error ?? null}
      activeToolCall={activeToolCall}
      toolSummaries={toolSummaries}
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
    events,
    isEventStreamOpen,
    statusContent,
    slashNotice,
    footerItems: buildChatFooterItems({
      isSlashPalette,
      isChatPending: chatMutation.isPending,
      hasComposerValue: Boolean(value.trim()),
      isEventStreamOpen,
    }),
  };

  const actions = {
    onBack,
    dismissSlashOrBack,
    handleInputChange,
    handleComposerSubmit,
    stopStt,
    stopChat,
    closeEventStream: () => setIsEventStreamOpen(false),
  };

  return [state, actions] as const;
}

export const { useContainer: useChatStore, Provider: ChatProvider } =
  createContainer<ReturnType<typeof useChatStoreLogic>, ChatStoreInitialState>(
    useChatStoreLogic,
  );
