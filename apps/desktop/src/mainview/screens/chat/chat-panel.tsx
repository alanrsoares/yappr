import { useCallback, useId, useRef, useState } from "react";

import { streamOllamaChat } from "~/lib/ollama";
import { cn } from "~/lib/utils";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "~/ui/chat-container";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import { Composer } from "./composer";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatPanel({ className }: { className?: string }) {
  const modelFieldId = useId();
  const [model, setModel] = useState("llama3.2");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    <aside
      className={cn(
        "flex w-full max-w-xl flex-col overflow-hidden rounded-md border border-black/60 bg-panel bg-panel-strip shadow-chassis",
        "min-h-[min(58dvh,480px)] @md/chat:min-h-[min(64dvh,520px)] @lg/chat:min-h-[min(70vh,560px)]",
        "@lg/chat:sticky @lg/chat:top-5 @lg/chat:max-h-[min(calc(100dvh-5rem),44rem)] @2xl/chat:max-h-[calc(100dvh-4rem)]",
        className,
      )}
    >
      <header className="border-b border-black/50 px-4 py-3">
        <h2 className="font-label text-xs font-medium uppercase tracking-[0.35em] text-foil-mute engraved">
          Chat
        </h2>
        <p className="mt-1 max-w-prose font-mono text-[0.6rem] leading-relaxed text-foil-dim @md/chat:text-[0.65rem]">
          Local Ollama via prompt-kit input. Dev: Vite proxies{" "}
          <code className="text-led-amber/80">/ollama</code>. Set{" "}
          <code className="text-led-amber/80">OLLAMA_ORIGINS</code> for packaged
          builds.
        </p>
        <div className="mt-3 flex flex-col gap-2 @sm/chat:flex-row @sm/chat:items-baseline @sm/chat:gap-3">
          <Label
            htmlFor={modelFieldId}
            className="font-label text-[0.55rem] uppercase tracking-[0.25em] text-foil-mute"
          >
            Model
          </Label>
          <Input
            id={modelFieldId}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3.2"
            className="h-8 w-full max-w-full border-black/70 bg-chassis-deep font-mono text-sm text-led-amber @sm/chat:max-w-[220px]"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </header>

      {error ? (
        <div
          className="border-b border-led-red/30 bg-led-red/10 px-4 py-2 font-mono text-xs text-led-red"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <ChatContainerRoot className="min-h-0 flex-1 bg-chassis-deep/40 px-2 py-3">
        <ChatContainerContent className="gap-3 px-2">
          {messages.length === 0 ? (
            <p className="px-2 font-mono text-xs text-foil-dim">
              No messages yet. Ensure Ollama is running (
              <code className="text-foil-mute">ollama serve</code>).
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[95%] rounded-sm border px-3 py-2 font-mono text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto border-led-amber/25 bg-panel text-foil"
                    : "mr-auto border-black/50 bg-panel-edge/80 text-foil",
                )}
              >
                {m.content || (busy ? "…" : "")}
              </div>
            ))
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t border-black/50 p-3">
        <Composer
          onSend={(t) => void send(t)}
          isBusy={busy}
          onStop={stop}
          disabled={!model.trim()}
          placeholder="Ask the local model… (Shift+Enter for newline)"
        />
      </div>
    </aside>
  );
}
