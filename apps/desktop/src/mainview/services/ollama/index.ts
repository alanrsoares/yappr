/**
 * Ollama HTTP root (no trailing `/api`). Must be an absolute URL: the
 * `@tanstack/ai-ollama` client runs `new URL(host)`, which rejects a bare
 * relative path. In dev we point at the same-origin Vite proxy (`/ollama` →
 * 127.0.0.1:11434, avoids CORS); in the packaged build we hit the loopback
 * daemon directly (relies on `OLLAMA_ORIGINS`).
 */
export const ollamaRoot = (): string =>
  import.meta.env.DEV
    ? `${globalThis.location.origin}/ollama`
    : "http://127.0.0.1:11434";

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

/** Default chat model — chosen first when no other selection is valid. */
export const DEFAULT_CHAT_MODEL = "llama3.2";

/**
 * Best-effort filter: exclude embedding models. Ollama exposes both chat and
 * embedding models on `/api/tags`; embedding model names contain `embed` by
 * convention (`nomic-embed-text`, `mxbai-embed-large`, etc.).
 */
const isCompletionModel = (m: OllamaModel): boolean =>
  !m.name.toLowerCase().includes("embed");

/**
 * Pure: pick a model from a fresh list, preserving the current selection
 * when valid. Curried (data-last) for use with React setters:
 *
 *   setModel((prev) => pickModel(prev)(models))
 *
 * Falls back to the first completion model, then to the first model overall,
 * then to the current value as a last resort.
 */
export const pickModel =
  (current: string) =>
  (models: readonly OllamaModel[]): string => {
    if (models.some((m) => m.name === current)) return current;
    const firstCompletion = models.find(isCompletionModel);
    return firstCompletion?.name ?? models[0]?.name ?? current;
  };

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
