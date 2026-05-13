import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageRow } from "@yappr/db/rpc";
import { isFileUIPart, type FileUIPart, type UIMessage } from "ai";
import { AlertTriangle, Copy, FileIcon, Square, Volume2 } from "lucide-react";

import { dbRpc } from "~/lib/db-rpc";
import {
  conversationsQueryRootKey,
  messagesOptions,
  ollamaModelsOptions,
} from "~/lib/queries";
import { cn } from "~/lib/utils";
import { OllamaTransport } from "~/services/ollama/transport";
import { useVoiceStore } from "~/stores/voice";
import { Button } from "~/ui/button";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "~/ui/chat-container";
import { DotsLoader } from "~/ui/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "~/ui/message";
import { Composer } from "../../../components/composer";
import { useChatStore } from "../store";
import { KaraokeCaptions } from "./karaoke-captions";

interface ChatPanelProps {
  model: string;
  onModelChange: (next: string) => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

function truncateTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

function dbToUIMessage(m: MessageRow): UIMessage {
  if (m.partsJson) {
    try {
      const parsed = JSON.parse(m.partsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          id: m.id,
          role: m.role,
          parts: parsed as UIMessage["parts"],
        };
      }
    } catch {
      /* legacy / corrupt row — fall through */
    }
  }
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  };
}

function buildUserParts(text: string, files: FileUIPart[]): UIMessage["parts"] {
  const trimmed = text.trim();
  const out: UIMessage["parts"] = [...files];
  if (trimmed) out.push({ type: "text", text: trimmed });
  return out;
}

function userRowContent(text: string, files: FileUIPart[]): string {
  const t = text.trim();
  if (t) return t;
  if (!files.length) return "";
  return files.map((f) => f.filename ?? f.mediaType).join(", ");
}

function uiTextOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

export function ChatPanel({
  model,
  onModelChange: _onModelChange,
  conversationId,
  onConversationChange,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery(messagesOptions(conversationId));
  const { data: models } = useQuery(ollamaModelsOptions);
  // Model must be present in the locally-installed list — otherwise Ollama
  // returns 404 mid-stream. Block sends until pickModel (in chat-layout) has
  // had a chance to resolve to a valid choice.
  const modelReady =
    Boolean(model) && (models?.some((m) => m.name === model) ?? false);
  // Stable empty-array ref so the hydration effect below doesn't loop on
  // every render when the query is disabled (conversationId === null) and
  // `data` stays undefined.
  const persisted = useMemo<MessageRow[]>(() => data ?? [], [data]);
  const [
    { tts, caption },
    { speak, pauseAudio, resumeAudio, restartAudio, stopAudio, transcribe },
  ] = useVoiceStore();
  const { inputDeviceId } = useChatStore();
  const isSpeaking = tts.kind === "speaking";
  const speakingMessageId =
    caption.kind === "active" ? caption.messageId : null;
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);

  const createConv = useMutation({
    mutationFn: (title: string) =>
      dbRpc.request("conversations:create", { title, model }),
  });
  const appendMessage = useMutation({
    mutationFn: (params: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
      partsJson?: string;
    }) => dbRpc.request("messages:append", params),
  });

  // Live conversation id captured at send-time so onFinish writes to the
  // right row even if the user navigates between conversations mid-stream.
  const liveConvIdRef = useRef<string | null>(conversationId);

  // useChat freezes the transport at first render. Wrap the model lookup in a
  // ref-backed getter so picking a different model at runtime takes effect
  // without re-creating the chat instance (which would lose live state).
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const transport = useMemo(
    // The closure is invoked later at send time, not during render — the lint
    // rule can't statically see that, so silence it.
    // eslint-disable-next-line react-hooks/refs
    () => new OllamaTransport(() => modelRef.current),
    [],
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport,
    onFinish: async ({ message }) => {
      const convId = liveConvIdRef.current;
      if (!convId) return;
      const text = uiTextOf(message);
      if (!text) return;
      await appendMessage.mutateAsync({
        conversationId: convId,
        role: "assistant",
        content: text,
      });
      queryClient.invalidateQueries({
        queryKey: messagesOptions(convId).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: conversationsQueryRootKey,
      });
    },
  });

  // Hydrate from the DB when the active conversation or persisted list
  // changes. Skip during an in-flight stream so the transport's live messages
  // aren't clobbered. setMessages is ref-stashed because useChat re-creates
  // its identity each render and would otherwise re-trigger the effect.
  const setMessagesRef = useRef(setMessages);
  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    liveConvIdRef.current = conversationId;
    setMessagesRef.current(persisted.map(dbToUIMessage));
  }, [conversationId, persisted, status]);

  const handleSubmit = useCallback(
    async (text: string, files: FileUIPart[]) => {
      if (!text.trim() && files.length === 0) return;
      const titleSeed = userRowContent(text, files);

      let convId = conversationId;
      if (!convId) {
        const conv = await createConv.mutateAsync(truncateTitle(titleSeed));
        convId = conv.id;
        onConversationChange(convId);
        queryClient.invalidateQueries({
          queryKey: conversationsQueryRootKey,
        });
      }
      liveConvIdRef.current = convId;
      const parts = buildUserParts(text, files);
      const partsJson = files.length > 0 ? JSON.stringify(parts) : undefined;
      await appendMessage.mutateAsync({
        conversationId: convId,
        role: "user",
        content: userRowContent(text, files),
        partsJson,
      });
      if (files.length > 0) {
        const trimmed = text.trim();
        if (trimmed) await sendMessage({ text: trimmed, files });
        else await sendMessage({ files });
      } else {
        await sendMessage({ text: text.trim() });
      }
    },
    [
      conversationId,
      onConversationChange,
      queryClient,
      createConv,
      appendMessage,
      sendMessage,
    ],
  );

  const isBusy = status === "submitted" || status === "streaming";

  // Show the typing indicator only between submit and the first token, so it
  // disappears the moment the assistant message starts populating.
  const showLoading =
    status === "submitted" &&
    !messages.some((m) => m.role === "assistant" && uiTextOf(m).length > 0);

  useEffect(() => {
    const node = composerShellRef.current;
    if (!node) return;
    const update = () => setComposerHeight(node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col">
      <ChatContainerRoot className="min-h-0 flex-1 px-4 py-4">
        <ChatContainerContent className="gap-6">
          {messages.length === 0 && !showLoading && !error ? (
            <EmptyState />
          ) : (
            messages.map((m, idx) => {
              const text = uiTextOf(m);
              const fileParts =
                m.parts?.filter((p): p is FileUIPart => isFileUIPart(p)) ?? [];
              const isLast = idx === messages.length - 1;
              return (
                <MessageBubble
                  key={m.id}
                  role={m.role === "system" ? "assistant" : m.role}
                  content={text || (isBusy ? "…" : "")}
                  fileAttachments={m.role === "user" ? fileParts : []}
                  isLast={isLast}
                  canSpeak={m.role === "assistant" && text.trim().length > 0}
                  isSpeaking={
                    isSpeaking &&
                    (speakingMessageId === m.id || speakingMessageId === null)
                  }
                  onSpeak={() => void speak(text, { messageId: m.id })}
                  onStop={stopAudio}
                />
              );
            })
          )}
          {showLoading ? <LoadingMessage /> : null}
          {error ? <ErrorMessage message={error.message} /> : null}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <KaraokeCaptions
        caption={caption}
        bottomOffset={composerHeight + 16}
        onPause={pauseAudio}
        onResume={resumeAudio}
        onRestart={restartAudio}
        onStop={stopAudio}
      />

      <div
        ref={composerShellRef}
        className="border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      >
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={(t, f) => void handleSubmit(t, f)}
            isBusy={isBusy}
            onStop={stop}
            disabled={!modelReady}
            placeholder={
              modelReady
                ? "Ask the local model… (Shift+Enter for newline)"
                : models
                  ? "Select an installed model to start chatting…"
                  : "Loading models from Ollama…"
            }
            transcribe={transcribe}
            inputDeviceId={inputDeviceId}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-12 max-w-md text-center text-muted-foreground">
      <p className="font-mono text-sm">No messages yet.</p>
      <p className="mt-2 font-mono text-xs text-muted-foreground/80">
        Make sure Ollama is running locally and a model is pulled.
      </p>
    </div>
  );
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  fileAttachments: FileUIPart[];
  isLast: boolean;
  canSpeak: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
}

const MessageBubble = memo(function MessageBubble({
  role,
  content,
  fileAttachments,
  isLast,
  canSpeak,
  isSpeaking,
  onSpeak,
  onStop,
}: MessageBubbleProps) {
  const copy = () => {
    const names = fileAttachments
      .map((f) => f.filename ?? f.mediaType)
      .join(", ");
    const payload =
      names && content.trim()
        ? `${content}\n\n[attachments: ${names}]`
        : names
          ? `[attachments: ${names}]`
          : content;
    void navigator.clipboard.writeText(payload);
  };

  // Actions are hover-only by default but stay on for the latest message —
  // copy/speak on the most recent reply is the common case, shouldn't hide.
  const actionsClass = cn(
    "gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
    isLast && "opacity-100",
  );

  if (role === "assistant") {
    return (
      <Message className="group mx-auto flex w-full max-w-3xl flex-col gap-1">
        <MessageContent
          markdown
          className="bg-transparent p-0 text-foreground prose prose-invert max-w-none"
        >
          {content}
        </MessageContent>
        <MessageActions className={actionsClass}>
          <MessageAction tooltip="Copy" delayDuration={100}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={copy}
              aria-label="Copy message"
              className="size-7 rounded-full"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </MessageAction>
          {canSpeak ? (
            <MessageAction
              tooltip={isSpeaking ? "Stop" : "Speak"}
              delayDuration={100}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isSpeaking ? onStop : onSpeak}
                aria-label={isSpeaking ? "Stop speaking" : "Speak this message"}
                className={cn(
                  "size-7 rounded-full",
                  isSpeaking && "text-led-amber",
                )}
              >
                {isSpeaking ? (
                  <Square className="size-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            </MessageAction>
          ) : null}
        </MessageActions>
      </Message>
    );
  }

  return (
    <Message className="group mx-auto flex w-full max-w-3xl flex-col items-end gap-1">
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2 rounded-3xl bg-secondary px-4 py-2 text-foreground break-words sm:max-w-[75%]",
        )}
      >
        {fileAttachments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fileAttachments.map((f, i) => (
              <li
                key={`att-${i}-${f.filename ?? f.mediaType}`}
                className="overflow-hidden rounded-lg border border-border/60 bg-background/40"
              >
                {f.mediaType.startsWith("image/") ? (
                  <img
                    src={f.url}
                    alt={f.filename ?? "attachment"}
                    className="max-h-40 w-full object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                    <FileIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {f.filename ?? f.mediaType}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {content.trim() ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : null}
      </div>
      <MessageActions className={actionsClass}>
        <MessageAction tooltip="Copy" delayDuration={100}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={copy}
            aria-label="Copy message"
            className="size-7 rounded-full"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </Button>
        </MessageAction>
      </MessageActions>
    </Message>
  );
});

const LoadingMessage = memo(function LoadingMessage() {
  return (
    <Message className="mx-auto flex w-full max-w-3xl flex-col gap-1">
      <div className="text-muted-foreground py-2">
        <DotsLoader />
      </div>
    </Message>
  );
});

const ErrorMessage = memo(function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <Message className="mx-auto flex w-full max-w-3xl flex-col gap-1">
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
      >
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </Message>
  );
});
