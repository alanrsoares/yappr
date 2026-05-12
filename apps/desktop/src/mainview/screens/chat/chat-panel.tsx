import { useCallback, useRef, useState } from "react";

import { Copy, Square, Volume2 } from "lucide-react";

import { streamOllamaChat } from "~/lib/ollama";
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const nextId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface ChatPanelProps {
  model: string;
  onModelChange: (next: string) => void;
}

export function ChatPanel({
  model,
  onModelChange: _onModelChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { tts, speak, stopAudio, transcribe } = useVoiceStore();
  const isSpeaking = tts.kind === "speaking";

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      setError(null);
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
      };
      const asstId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: asstId, role: "assistant", content: "" },
      ]);

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);

      try {
        await streamOllamaChat(
          model.trim() || "llama3.2",
          history,
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, content: m.content + chunk } : m,
              ),
            );
          },
          ac.signal,
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId && m.content.length === 0
                ? { ...m, content: "— stopped —" }
                : m,
            ),
          );
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          setMessages((prev) => prev.filter((m) => m.id !== asstId));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [messages, model],
  );

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
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content || (busy ? "…" : "")}
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
        <MessageActions className="-ml-2 gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
