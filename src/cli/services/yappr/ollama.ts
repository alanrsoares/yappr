import { ResultAsync } from "neverthrow";
import ollama, { Ollama } from "ollama";

import { toError } from "~/lib/result.js";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function getOllamaClient(baseUrl?: string): Ollama {
  const url = baseUrl?.trim() || DEFAULT_OLLAMA_URL;
  if (url === DEFAULT_OLLAMA_URL) return ollama as Ollama;
  return new Ollama({ host: url });
}

export function listOllamaModels(
  baseUrl?: string,
): ResultAsync<string[], Error> {
  const client = getOllamaClient(baseUrl);
  return ResultAsync.fromPromise(
    client
      .list()
      .then((res) =>
        (res.models ?? [])
          .map((m) => m.name?.trim() || m.model?.trim() || "")
          .filter(Boolean),
      ),
    toError,
  );
}
