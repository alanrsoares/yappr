import { useCallback, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Square, Volume2 } from "lucide-react";

import { dbRpc } from "~/lib/db-rpc";
import { DEFAULT_CHAT_MODEL, streamOllamaChat } from "~/lib/ollama";
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

export function ChatPanel({
  model,
  onModelChange: _onModelChange,
  conversationId,
  onConversationChange,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const { data: persisted = [] } = useQuery(messagesOptions(conversationId));

  // Streaming buffer for the in-flight assistant reply. Lives in component
  // state because the DB doesn't see the message until streaming completes —
  // we render it concatenated onto `persisted` for the duration.
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(
    null,
  );
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      setError(null);
      // Ensure a conversation exists. First send on a blank state creates one
      // titled from the user's prompt; subsequent sends reuse the active id.
      let convId = conversationId;
      if (!convId) {
        const conv = await createConv.mutateAsync(truncateTitle(text));
        convId = conv.id;
        onConversationChange(convId);
        queryClient.invalidateQueries({
          queryKey: conversationsOptions.queryKey,
        });
      }

      // Persist the user turn before streaming so a crash/refresh keeps it.
      setPendingUser(text);
      await appendMessage.mutateAsync({
        conversationId: convId,
        role: "user",
        content: text,
      });
      setPendingUser(null);
      queryClient.invalidateQueries({
        queryKey: messagesOptions(convId).queryKey,
      });

      const history = [
        ...persisted,
        { role: "user" as const, content: text },
      ].map((m) => ({ role: m.role, content: m.content }));

      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setStreamingAssistant("");

      let buffer = "";
      try {
        await streamOllamaChat(
          model.trim() || DEFAULT_CHAT_MODEL,
          history,
          (chunk) => {
            buffer += chunk;
            setStreamingAssistant(buffer);
          },
          ac.signal,
        );
        if (buffer.length > 0) {
          await appendMessage.mutateAsync({
            conversationId: convId,
            role: "assistant",
            content: buffer,
          });
          queryClient.invalidateQueries({
            queryKey: messagesOptions(convId).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: conversationsOptions.queryKey,
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        } else if (buffer.length > 0) {
          // Aborted mid-stream — keep what we have so far.
          await appendMessage.mutateAsync({
            conversationId: convId,
            role: "assistant",
            content: buffer,
          });
          queryClient.invalidateQueries({
            queryKey: messagesOptions(convId).queryKey,
          });
        }
      } finally {
        setBusy(false);
        setStreamingAssistant(null);
        abortRef.current = null;
      }
    },
    [
      conversationId,
      persisted,
      model,
      createConv,
      appendMessage,
      onConversationChange,
      queryClient,
    ],
  );

  const rendered = useMemo(() => {
    type Render = { id: string; role: "user" | "assistant"; content: string };
    const out: Render[] = persisted.map((m) => ({
      id: m.id,
      role: m.role === "system" ? "assistant" : m.role,
      content: m.content,
    }));
    if (pendingUser) {
      out.push({ id: "pending-user", role: "user", content: pendingUser });
    }
    if (streamingAssistant !== null) {
      out.push({
        id: "streaming",
        role: "assistant",
        content: streamingAssistant || (busy ? "…" : ""),
      });
    }
    return out;
  }, [persisted, pendingUser, streamingAssistant, busy]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      {error ? (
        <div
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 font-mono text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <ChatContainerRoot className="min-h-0 flex-1 px-4 py-4">
        <ChatContainerContent className="gap-4">
          {rendered.length === 0 ? (
            <EmptyState />
          ) : (
            rendered.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                canSpeak={m.role === "assistant" && m.content.trim().length > 0}
                isSpeaking={isSpeaking}
                onSpeak={() => void speak(m.content)}
                onStop={stopAudio}
              />
            ))
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={(t) => void send(t)}
            isBusy={busy}
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

  // User message — right-aligned bubble.
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
