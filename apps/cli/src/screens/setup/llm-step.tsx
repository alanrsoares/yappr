import { Effect } from "effect";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useMemo, useState } from "react";

import { Loading } from "~/components";
import { useKeyboard } from "~/hooks";
import { clampSelectedIndex, cycleIndex } from "~/list-nav.js";
import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { listOllamaModels, listOpenRouterModels } from "~/services/yappr";
import { semantic } from "~/theme/semantic.js";
import type { ChatProvider } from "~/types.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export interface LlmStepProps {
  initialProvider: ChatProvider;
  initialModel: string;
  initialOllamaUrl: string;
  initialOpenrouterKey: string;
  onSave: (next: {
    defaultChatProvider: ChatProvider;
    defaultChatModel?: string;
    ollamaBaseUrl: string;
    openrouterApiKey: string;
  }) => void;
  onSkip: () => void;
}

type Phase = "select" | "input" | "checking" | "error" | "model";

const PROVIDERS: ReadonlyArray<{
  kind: ChatProvider;
  label: string;
  description: string;
}> = [
  {
    kind: "ollama",
    label: "Ollama (local)",
    description: "Run open-weight models locally via Ollama (no API key).",
  },
  {
    kind: "openrouter",
    label: "OpenRouter (cloud)",
    description: "Access Claude, GPT, Gemini & more via OpenRouter API.",
  },
];

const MAX_VISIBLE_MODELS = 8;

export function LlmStep({
  initialProvider,
  initialModel,
  initialOllamaUrl,
  initialOpenrouterKey,
  onSave,
  onSkip,
}: LlmStepProps) {
  const [provider, setProvider] = useState<ChatProvider>(initialProvider);
  const [ollamaUrl, setOllamaUrl] = useState(
    initialOllamaUrl || DEFAULT_OLLAMA_URL,
  );
  const [openrouterKey, setOpenrouterKey] = useState(initialOpenrouterKey);
  const [phase, setPhase] = useState<Phase>("select");
  const [models, setModels] = useState<readonly string[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);

  const normalizedUrl = ollamaUrl.trim() || DEFAULT_OLLAMA_URL;
  const normalizedKey = openrouterKey.trim();

  const saveConfig = useCallback(
    (chosenModel?: string) => {
      onSave({
        defaultChatProvider: provider,
        ...(chosenModel ? { defaultChatModel: chosenModel } : {}),
        ollamaBaseUrl: normalizedUrl,
        openrouterApiKey: normalizedKey,
      });
    },
    [onSave, provider, normalizedUrl, normalizedKey],
  );

  const testAndFetchModels = useCallback(() => {
    if (provider === "openrouter" && !normalizedKey) {
      saveConfig();
      return;
    }
    setPhase("checking");
    setCheckError(null);

    const effect =
      provider === "ollama"
        ? listOllamaModels(normalizedUrl)
        : listOpenRouterModels(normalizedKey).pipe(
            Effect.map((list) => list.map((m) => m.id)),
          );

    void Effect.runPromise(effect).then(
      (fetched) => {
        setModels(fetched);
        if (fetched.length > 0) {
          setPhase("model");
        } else {
          setCheckError(
            provider === "ollama"
              ? "Connected to Ollama, but no models are installed yet (run `ollama pull <model>`)."
              : "No tool-capable models returned for this API key.",
          );
          setPhase("error");
        }
      },
      (err: unknown) => {
        setCheckError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      },
    );
  }, [provider, normalizedUrl, normalizedKey, saveConfig]);

  if (phase === "select") {
    return (
      <SelectProviderPhase
        initial={provider}
        onPick={(picked) => {
          setProvider(picked);
          setPhase("input");
        }}
        onSkip={onSkip}
      />
    );
  }

  if (phase === "input") {
    return (
      <InputPhase
        provider={provider}
        value={provider === "ollama" ? ollamaUrl : openrouterKey}
        onChange={provider === "ollama" ? setOllamaUrl : setOpenrouterKey}
        onSubmit={testAndFetchModels}
        onSaveWithoutCheck={() => saveConfig()}
        onBack={() => setPhase("select")}
      />
    );
  }

  if (phase === "checking") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Loading
          message={
            provider === "ollama"
              ? `Connecting to Ollama at ${normalizedUrl}…`
              : "Verifying OpenRouter API key & fetching models…"
          }
        />
      </Box>
    );
  }

  if (phase === "error") {
    return (
      <ErrorPhase
        error={checkError ?? "Connection failed."}
        onRetry={testAndFetchModels}
        onEdit={() => setPhase("input")}
        onSaveAnyway={() => saveConfig()}
      />
    );
  }

  return (
    <SelectModelPhase
      provider={provider}
      models={models}
      current={initialModel}
      onPick={(model) => saveConfig(model)}
    />
  );
}

function SelectProviderPhase({
  initial,
  onPick,
  onSkip,
}: {
  initial: ChatProvider;
  onPick: (provider: ChatProvider) => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      PROVIDERS.findIndex((p) => p.kind === initial),
    ),
  );

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () => setIndex((i) => cycleIndex(i, PROVIDERS.length, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () => setIndex((i) => cycleIndex(i, PROVIDERS.length, 1)),
      },
      {
        keys: ["return"],
        action: () => onPick(PROVIDERS[index]?.kind ?? "ollama"),
      },
      { keys: ["s"], action: onSkip },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>↑/↓ choose · Enter configure · s skip step</Text>
      <Box flexDirection="column" marginTop={1}>
        {PROVIDERS.map((opt, i) => {
          const selected = i === index;
          return (
            <Box key={opt.kind} flexDirection="column" marginBottom={1}>
              <Text
                color={selected ? semantic.accent : undefined}
                bold={selected}
              >
                {listSelectionPrefix(selected)}
                {opt.label}
              </Text>
              <Text dimColor>{`  ${opt.description}`}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function InputPhase({
  provider,
  value,
  onChange,
  onSubmit,
  onSaveWithoutCheck,
  onBack,
}: {
  provider: ChatProvider;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSaveWithoutCheck: () => void;
  onBack: () => void;
}) {
  useKeyboard({
    bindings: [
      { keys: ["ctrl+s"], action: onSaveWithoutCheck },
      { keys: ["ctrl+b"], action: onBack },
    ],
  });

  const isOllama = provider === "ollama";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        {isOllama
          ? "Ollama base URL · Enter tests connection · Ctrl+S saves as-is · Ctrl+B back"
          : "OpenRouter API key · Enter verifies & loads models · blank saves without key · Ctrl+B back"}
      </Text>
      <Box
        borderStyle="round"
        borderColor={semantic.border.composer}
        paddingX={1}
        marginTop={1}
        flexDirection="row"
        alignItems="center"
      >
        <Box marginRight={1}>
          <Text color={semantic.accent} bold>
            {isOllama ? "URL ›" : "Key ›"}
          </Text>
        </Box>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          mask={isOllama ? undefined : "*"}
          placeholder={isOllama ? DEFAULT_OLLAMA_URL : "sk-or-..."}
        />
      </Box>
    </Box>
  );
}

function ErrorPhase({
  error,
  onRetry,
  onEdit,
  onSaveAnyway,
}: {
  error: string;
  onRetry: () => void;
  onEdit: () => void;
  onSaveAnyway: () => void;
}) {
  useKeyboard({
    bindings: [
      { keys: ["r"], action: onRetry },
      { keys: ["e"], action: onEdit },
      { keys: ["return"], action: onSaveAnyway },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={semantic.error}>✗ {error}</Text>
      <Box marginTop={1}>
        <Text dimColor>r retry · e edit settings · Enter save anyway</Text>
      </Box>
    </Box>
  );
}

function SelectModelPhase({
  provider,
  models,
  current,
  onPick,
}: {
  provider: ChatProvider;
  models: readonly string[];
  current: string;
  onPick: (model: string) => void;
}) {
  const initialIdx = useMemo(
    () => Math.max(0, models.indexOf(current)),
    [models, current],
  );

  const [index, setIndex] = useState(initialIdx);
  const effectiveIndex = clampSelectedIndex(index, models.length);

  const windowStart =
    models.length <= MAX_VISIBLE_MODELS
      ? 0
      : Math.min(
          Math.max(0, effectiveIndex - Math.floor(MAX_VISIBLE_MODELS / 2)),
          models.length - MAX_VISIBLE_MODELS,
        );
  const visible = models.slice(windowStart, windowStart + MAX_VISIBLE_MODELS);

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () => setIndex((i) => cycleIndex(i, models.length, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () => setIndex((i) => cycleIndex(i, models.length, 1)),
      },
      {
        keys: ["return"],
        action: () => onPick(models[effectiveIndex] ?? models[0] ?? current),
      },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={semantic.success}>
        ✓ Connected ({provider}) — {models.length} models available.
      </Text>
      <Text dimColor>↑/↓ pick default chat model · Enter confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((m, i) => {
          const idx = windowStart + i;
          const selected = idx === effectiveIndex;
          return (
            <Text
              key={m}
              color={selected ? semantic.accent : undefined}
              bold={selected}
            >
              {listSelectionPrefix(selected)}
              {m}
              {m === current ? " (current)" : ""}
            </Text>
          );
        })}
        {models.length > MAX_VISIBLE_MODELS && (
          <Text dimColor>
            Showing {windowStart + 1}–{windowStart + visible.length} of{" "}
            {models.length}
          </Text>
        )}
      </Box>
    </Box>
  );
}
