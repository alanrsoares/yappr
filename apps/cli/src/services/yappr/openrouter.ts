import { toError } from "@yappr/lib/result";
import { Effect } from "effect";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterModelInfo {
  id: string;
  name: string;
}

interface OpenRouterModelArchitecture {
  input_modalities?: string[];
}

interface OpenRouterModelsListEntry {
  id?: string;
  name?: string;
  architecture?: OpenRouterModelArchitecture;
  supported_parameters?: string[];
}

interface OpenRouterModelsApiResponse {
  data?: OpenRouterModelsListEntry[];
}

type OpenRouterModelWithId = OpenRouterModelsListEntry & { id: string };

function isUsableOpenRouterModel(
  m: OpenRouterModelsListEntry,
): m is OpenRouterModelWithId {
  const hasText = m.architecture?.input_modalities?.includes("text") ?? true;
  const hasTools = m.supported_parameters?.includes("tools") ?? false;
  return Boolean(m.id && hasText && hasTools);
}

async function readOpenRouterFailureMessage(res: Response): Promise<string> {
  const text = await res.text();
  return `${res.status}: ${text}`;
}

async function throwOpenRouterHttpError(res: Response): Promise<never> {
  throw new Error(await readOpenRouterFailureMessage(res));
}

/**
 * List tool-capable OpenRouter models for the settings picker. Chat itself
 * goes through `@tanstack/ai-openrouter` (see chat/runtime.ts), not this file.
 */
export const listOpenRouterModels = (
  apiKey: string,
): Effect.Effect<OpenRouterModelInfo[], Error> =>
  !apiKey.trim()
    ? Effect.succeed([])
    : Effect.tryPromise({
        try: async () => {
          const res = await fetch(
            `${OPENROUTER_BASE}/models?supported_parameters=tools`,
            {
              headers: { Authorization: `Bearer ${apiKey.trim()}` },
            },
          );
          if (!res.ok) await throwOpenRouterHttpError(res);
          const json = (await res.json()) as OpenRouterModelsApiResponse;
          const list = json.data ?? [];
          return list
            .filter(isUsableOpenRouterModel)
            .map((m) => ({
              id: m.id,
              name: m.name ?? m.id,
            }))
            .toSorted((a, b) => a.name.localeCompare(b.name));
        },
        catch: toError,
      });
