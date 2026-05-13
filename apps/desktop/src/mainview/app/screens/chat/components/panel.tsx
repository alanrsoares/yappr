import { memo, useEffect, useRef, useState } from "react";

import { isFileUIPart, type FileUIPart } from "ai";
import {
  AlertTriangle,
  Copy,
  FileIcon,
  RefreshCcw,
  Square,
  Volume2,
} from "lucide-react";

import { measureUserTextBubbleWidth } from "~/lib/message-bubble-layout";
import { markdownToNarrationText } from "~/lib/narration-text";
import { cn } from "~/lib/utils";
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
import { chatMessageText, useChatStore } from "../store";
import { KaraokeCaptions } from "./karaoke-captions";

export function ChatPanel() {
  const [
    { tts, caption },
    { speak, pauseAudio, resumeAudio, restartAudio, stopAudio, transcribe },
  ] = useVoiceStore();
  const [
    {
      messages,
      error,
      isBusy,
      showLoading,
      modelReady,
      modelsLoaded,
      inputDeviceId,
    },
    { submit, regenerateMessage, stop },
  ] = useChatStore();
  const isSpeaking = tts.kind === "speaking";
  const speakingMessageId =
    caption.kind === "active" ? caption.messageId : null;
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);

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
              const text = chatMessageText(m);
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
                  canRegenerate={
                    m.role === "assistant" &&
                    isLast &&
                    !isBusy &&
                    text.trim().length > 0
                  }
                  isSpeaking={
                    isSpeaking &&
                    (speakingMessageId === m.id || speakingMessageId === null)
                  }
                  onRegenerate={() => void regenerateMessage(m.id)}
                  onSpeak={() =>
                    void speak(markdownToNarrationText(text), {
                      messageId: m.id,
                    })
                  }
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
            onSend={(t, f) => void submit(t, f)}
            isBusy={isBusy}
            onStop={stop}
            disabled={!modelReady}
            placeholder={
              modelReady
                ? "Ask the local model… (Shift+Enter for newline)"
                : modelsLoaded
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
  canRegenerate: boolean;
  isSpeaking: boolean;
  onRegenerate: () => void;
  onSpeak: () => void;
  onStop: () => void;
}

const MessageBubble = memo(function MessageBubble({
  role,
  content,
  fileAttachments,
  isLast,
  canSpeak,
  canRegenerate,
  isSpeaking,
  onRegenerate,
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
  const messageRef = useRef<HTMLDivElement | null>(null);
  const [userBubbleWidth, setUserBubbleWidth] = useState<number | null>(null);
  const shouldMeasureUserBubble =
    role === "user" &&
    fileAttachments.length === 0 &&
    content.trim().length > 0;

  useEffect(() => {
    const node = messageRef.current;
    if (!node || !shouldMeasureUserBubble) {
      setUserBubbleWidth(null);
      return;
    }
    const update = () => {
      const rowWidth = node.getBoundingClientRect().width;
      const ratio = window.matchMedia("(min-width: 640px)").matches
        ? 0.75
        : 0.85;
      setUserBubbleWidth(measureUserTextBubbleWidth(content, rowWidth * ratio));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, shouldMeasureUserBubble]);

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
          {canRegenerate ? (
            <MessageAction tooltip="Regenerate" delayDuration={100}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRegenerate}
                aria-label="Regenerate response"
                className="size-7 rounded-full"
              >
                <RefreshCcw className="size-3.5" aria-hidden="true" />
              </Button>
            </MessageAction>
          ) : null}
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
    <Message
      ref={messageRef}
      className="group mx-auto flex w-full max-w-3xl flex-col items-end gap-1"
    >
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2 rounded-3xl bg-secondary px-4 py-2 text-foreground break-words sm:max-w-[75%]",
        )}
        style={
          userBubbleWidth === null
            ? undefined
            : { width: `${userBubbleWidth}px` }
        }
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
