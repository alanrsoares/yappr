/** Ollama HTTP root: Vite dev proxies `/ollama` → 127.0.0.1:11434 to avoid CORS. */
export function ollamaRoot(): string {
  return import.meta.env.DEV ? "/ollama" : "http://127.0.0.1:11434";
}

/** Model entry returned by `GET /api/tags`. */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

/** List models the local Ollama daemon has pulled. */
export async function listOllamaModels(
  signal?: AbortSignal,
): Promise<OllamaModel[]> {
  const res = await fetch(`${ollamaRoot()}/api/tags`, { signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Ollama HTTP ${res.status}`);
  }
  const data = (await res.json()) as { models?: OllamaModel[] };
  return data.models ?? [];
}

/** Human-friendly size string from raw bytes. */
export function formatModelSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
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
