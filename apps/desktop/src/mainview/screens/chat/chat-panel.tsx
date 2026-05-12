import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageRow } from "@yappr/db/rpc";
import type { UIMessage } from "ai";
import { AlertTriangle, Copy, Square, Volume2 } from "lucide-react";

import { dbRpc } from "~/lib/db-rpc";
import { OllamaTransport } from "~/lib/ollama-transport";
import {
  conversationsQueryRootKey,
  messagesOptions,
  ollamaModelsOptions,
} from "~/lib/queries";
import { cn } from "~/lib/utils";
import { useVoiceStore } from "~/lib/voice-store";
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
import { Composer } from "./composer";

interface ChatPanelProps {
  model: string;
  onModelChange: (next: string) => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

function truncateTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? trimmed.slice(0, 48) + "…" : trimmed;
}

function dbToUIMessage(m: MessageRow): UIMessage {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  };
}

function uiTextOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
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
    !!model && (models?.some((m) => m.name === model) ?? false);
  // Stable empty-array ref so the hydration effect below doesn't loop on
  // every render when the query is disabled (conversationId === null) and
  // `data` stays undefined.
  const persisted = useMemo<MessageRow[]>(() => data ?? [], [data]);
  const { tts, speak, stopAudio, transcribe } = useVoiceStore();
  const isSpeaking = tts.kind === "speaking";

  const createConv = useMutation({
    mutationFn: (title: string) =>
      dbRpc.request("conversations:create", { title, model }),
  });
  const appendMessage = useMutation({
    mutationFn: (params: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
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
    async (text: string) => {
      let convId = conversationId;
      if (!convId) {
        const conv = await createConv.mutateAsync(truncateTitle(text));
        convId = conv.id;
        onConversationChange(convId);
        queryClient.invalidateQueries({
          queryKey: conversationsQueryRootKey,
        });
      }
      liveConvIdRef.current = convId;
      await appendMessage.mutateAsync({
        conversationId: convId,
        role: "user",
        content: text,
      });
      sendMessage({ text });
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

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <ChatContainerRoot className="min-h-0 flex-1 px-4 py-4">
        <ChatContainerContent className="gap-6">
          {messages.length === 0 && !showLoading && !error ? (
            <EmptyState />
          ) : (
            messages.map((m, idx) => {
              const text = uiTextOf(m);
              const isLast = idx === messages.length - 1;
              return (
                <MessageBubble
                  key={m.id}
                  role={m.role === "system" ? "assistant" : m.role}
                  content={text || (isBusy ? "…" : "")}
                  isLast={isLast}
                  canSpeak={m.role === "assistant" && text.trim().length > 0}
                  isSpeaking={isSpeaking}
                  onSpeak={() => void speak(text)}
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

      <div className="border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={(t) => void handleSubmit(t)}
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
  isLast: boolean;
  canSpeak: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
}

const MessageBubble = memo(function MessageBubble({
  role,
  content,
  isLast,
  canSpeak,
  isSpeaking,
  onSpeak,
  onStop,
}: MessageBubbleProps) {
  const copy = () => {
    void navigator.clipboard.writeText(content);
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
      <MessageContent className="max-w-[85%] rounded-3xl bg-secondary px-4 py-2 text-foreground whitespace-pre-wrap sm:max-w-[75%]">
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
