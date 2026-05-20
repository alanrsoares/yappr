import { useCallback, useMemo, useRef, useState } from "react";

import {
  findInsertedImagePath,
  formatImageToken,
  parseImageTokens,
} from "@yappr/lib/image-path";
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
  imagePathExists,
  looksLikeImagePath,
  normalizeImagePath,
  readClipboardImage,
} from "~/services/clipboard.js";
import { chat, recordAndTranscribe, speak } from "~/services/yappr";
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

  const [value, setValueState] = useState("");
  const [cursor, setCursor] = useState(0);
  const setValue = useCallback((next: string | ((v: string) => string)) => {
    setValueState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      setCursor(resolved.length);
      return resolved;
    });
  }, []);
  const setComposer = useCallback((nextValue: string, nextCursor: number) => {
    setValueState(nextValue);
    setCursor(Math.min(Math.max(nextCursor, 0), nextValue.length));
  }, []);
  const [slashNotice, setSlashNotice] = useState<string | null>(null);
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [isEventStreamOpen, setIsEventStreamOpen] = useState(false);
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const runStartedAtRef = useRef(0);
  const lastStreamingTextRef = useRef("");
  const firstTokenAtRef = useRef<number | null>(null);
  const ttsStartedAtRef = useRef<number | null>(null);
  const ttsModeRef = useRef<"direct" | null>(null);
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

  const chatMutation = useMutation<
    string | null,
    Error,
    { prompt: string; images: string[] }
  >(({ prompt, images }) => {
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
    const promptWithAttachmentHint =
      images.length > 0
        ? `${prompt}${prompt ? "\n\n" : ""}[attached: ${images
            .map((p) => p.split("/").pop() ?? p)
            .join(", ")}]`
        : prompt;
    emit({
      type: "message.user",
      runId,
      conversationId: conversationIdRef.current,
      content: promptWithAttachmentHint,
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
    const userMessage: ChatMessage = {
      role: "user",
      content: promptWithAttachmentHint,
    };
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
      images,
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
        const startedAt = Date.now();
        ttsStartedAtRef.current = startedAt;
        ttsModeRef.current = "direct";
        emit({
          type: "tts.start",
          runId,
          conversationId: conversationIdRef.current,
          voice,
          mode: "direct",
          contentLength: text.length,
        });
        return speak(text, { voice }).map(() => {
          ttsStartedAtRef.current = null;
          ttsModeRef.current = null;
          emit({
            type: "tts.end",
            runId,
            conversationId: conversationIdRef.current,
            status: "success",
            elapsedMs: Date.now() - startedAt,
          });
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
    setPendingAttachments([]);
    // Detach from the current conversation row — next send will start a new
    // one. The previous conversation stays in the DB for browsing later.
    conversationIdRef.current = null;
  }, [stopChat, stopStt, chatMutation, sttMutation]);

  const attachImageFromClipboard = useCallback(() => {
    void readClipboardImage().match(
      (path) => {
        if (!path) {
          setSlashNotice("No image on clipboard.");
          return;
        }
        const tokenN = pendingAttachments.length + 1;
        const token = formatImageToken(tokenN);
        const c = Math.min(Math.max(cursor, 0), value.length);
        const before = value.slice(0, c);
        const after = value.slice(c);
        const leftSep = before.length > 0 && !before.endsWith(" ") ? " " : "";
        const rightSep = after.length > 0 && !after.startsWith(" ") ? " " : "";
        const inserted = `${leftSep}${token}${rightSep}`;
        setPendingAttachments((prev) => [...prev, path]);
        setComposer(`${before}${inserted}${after}`, c + inserted.length);
      },
      (err) => setSlashNotice(`Clipboard read failed: ${err.message}`),
    );
  }, [cursor, value, pendingAttachments.length, setComposer]);

  const removeAttachment = useCallback((idx: number) => {
    setPendingAttachments((p) => p.filter((_, i) => i !== idx));
  }, []);

  const clearAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const { isLeakage } = useVoiceToggle({
    isRecording: sttPhase === "recording",
    onStart: startStt,
    onStop: stopStt,
    onValueChange: setValue,
  });

  const handleInputChange = useCallback(
    (val: string, nextCursor: number) => {
      setSlashNotice(null);
      if (isLeakage(val, value)) return;
      const inserted = findInsertedImagePath(value, val);
      if (inserted) {
        const tokenN = pendingAttachments.length + 1;
        void imagePathExists(inserted.path).match(
          (exists) => {
            if (!exists) {
              setComposer(val, nextCursor);
              return;
            }
            const token = formatImageToken(tokenN);
            const merged =
              val.slice(0, inserted.startIdx) +
              token +
              val.slice(inserted.endIdx);
            setPendingAttachments((prev) => [...prev, inserted.path]);
            setComposer(merged, inserted.startIdx + token.length);
          },
          () => setComposer(val, nextCursor),
        );
        return;
      }
      setComposer(val, nextCursor);
    },
    [isLeakage, value, setComposer, pendingAttachments.length],
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
  ]);

  const handleComposerSubmit = useCallback(
    (raw: string, slashPick?: string) => {
      const t = raw.trim();
      const hasAttachments = pendingAttachments.length > 0;
      if (!t && !hasAttachments) return;
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
      const submit = (prompt: string, images: string[]) => {
        chatMutation.mutate({ prompt, images });
        setValue("");
        setPendingAttachments([]);
      };
      if (looksLikeImagePath(t)) {
        const path = normalizeImagePath(t);
        void imagePathExists(path).match(
          (exists) => {
            if (exists)
              submit("What's in this image?", [...pendingAttachments, path]);
            else submit(t, pendingAttachments);
          },
          () => submit(t, pendingAttachments),
        );
        return;
      }
      const { prompt: tokenStrippedPrompt, images: tokenImages } =
        parseImageTokens(t, pendingAttachments);
      const images = tokenImages.length > 0 ? tokenImages : pendingAttachments;
      const finalPrompt =
        !tokenStrippedPrompt && images.length > 0
          ? "What's in this image?"
          : tokenStrippedPrompt;
      submit(finalPrompt, images);
    },
    [buildSlashContext, chatMutation, sttMutation, pendingAttachments],
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
    value,
    cursor,
    messages,
    streamingResponse,
    events,
    isEventStreamOpen,
    statusContent,
    slashNotice,
    pendingAttachments,
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
    attachImageFromClipboard,
    removeAttachment,
    clearAttachments,
  };

  return [state, actions] as const;
}

export const { useContainer: useChatStore, Provider: ChatProvider } =
  createContainer<ReturnType<typeof useChatStoreLogic>, ChatStoreInitialState>(
    useChatStoreLogic,
  );
