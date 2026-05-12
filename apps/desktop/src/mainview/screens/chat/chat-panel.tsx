import { useCallback, useEffect, useMemo, useRef } from "react";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageRow } from "@yappr/db/rpc";
import type { UIMessage } from "ai";
import { Copy, Square, Volume2 } from "lucide-react";

import { dbRpc } from "~/lib/db-rpc";
import { OllamaTransport } from "~/lib/ollama-transport";
import { conversationsOptions, messagesOptions } from "~/lib/queries";
import { cn } from "~/lib/utils";
import { useVoiceStore } from "~/lib/voice-store";
import { Button } from "~/ui/button";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "~/ui/chat-container";
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

  const transport = useMemo(() => new OllamaTransport(model), [model]);

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
        queryKey: conversationsOptions.queryKey,
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
          queryKey: conversationsOptions.queryKey,
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

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      {error ? (
        <div
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 font-mono text-xs text-destructive"
          role="alert"
        >
          {error.message}
        </div>
      ) : null}

      <ChatContainerRoot className="min-h-0 flex-1 px-4 py-4">
        <ChatContainerContent className="gap-4">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m) => {
              const text = uiTextOf(m);
              return (
                <MessageBubble
                  key={m.id}
                  role={m.role === "system" ? "assistant" : m.role}
                  content={text || (isBusy ? "…" : "")}
                  canSpeak={m.role === "assistant" && text.trim().length > 0}
                  isSpeaking={isSpeaking}
                  onSpeak={() => void speak(text)}
                  onStop={stopAudio}
                />
              );
            })
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={(t) => void handleSubmit(t)}
            isBusy={isBusy}
            onStop={stop}
            disabled={!model.trim()}
            placeholder="Ask the local model… (Shift+Enter for newline)"
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
  canSpeak: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
}

function MessageBubble({
  role,
  content,
  canSpeak,
  isSpeaking,
  onSpeak,
  onStop,
}: MessageBubbleProps) {
  const copy = () => {
    void navigator.clipboard.writeText(content);
  };

  if (role === "assistant") {
    return (
      <Message className="group mx-auto flex w-full max-w-3xl flex-col gap-1">
        <MessageContent
          markdown
          className="bg-transparent p-0 text-foreground prose prose-invert prose-sm max-w-none"
        >
          {content}
        </MessageContent>
        <MessageActions className="gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
      <MessageActions className="gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
}
