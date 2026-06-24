import { toError } from "@yappr/lib/result";
import { Effect } from "effect";
import ollama, { Ollama } from "ollama";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function getOllamaClient(baseUrl?: string): Ollama {
  const url = baseUrl?.trim() || DEFAULT_OLLAMA_URL;
  return url === DEFAULT_OLLAMA_URL
    ? (ollama as Ollama)
    : new Ollama({ host: url });
}

export function listOllamaModels(
  baseUrl?: string,
): Effect.Effect<string[], Error> {
  const client = getOllamaClient(baseUrl);
  return Effect.tryPromise({
    try: () =>
      client
        .list()
        .then((res) =>
          (res.models ?? [])
            .map((m) => m.name?.trim() || m.model?.trim() || "")
            .filter(Boolean),
        ),
    catch: toError,
  });
}
