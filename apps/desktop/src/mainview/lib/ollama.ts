/** Ollama HTTP root: Vite dev proxies `/ollama` → 127.0.0.1:11434 to avoid CORS. */
export function ollamaRoot(): string {
  return import.meta.env.DEV ? "/ollama" : "http://127.0.0.1:11434";
}

type OllamaChatLine = {
  message?: { role?: string; content?: string };
  done?: boolean;
};

/**
 * Streams `/api/chat` (NDJSON). `onDelta` receives each incremental `message.content` chunk.
 */
export async function streamOllamaChat(
  model: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const root = ollamaRoot();
  const res = await fetch(`${root}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ollama HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Empty response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: OllamaChatLine;
      try {
        parsed = JSON.parse(trimmed) as OllamaChatLine;
      } catch {
        continue;
      }
      const piece = parsed.message?.content;
      if (piece) onDelta(piece);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      const parsed = JSON.parse(tail) as OllamaChatLine;
      const piece = parsed.message?.content;
      if (piece) onDelta(piece);
    } catch {
      /* ignore trailing garbage */
    }
  }
}
