import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Footer, Header, Loading } from "~/components";
import { DEFAULT_KEYS } from "~/constants.js";
import { footerQuit } from "~/footer-items.js";
import { useKeyboard, useMutation, usePreferences } from "~/hooks";
import {
  findRepoRoot,
  pythonVenvExists,
  runUvSync,
} from "~/lib/python-bootstrap.js";
import {
  checkSystemBinaries,
  type SystemBinaryStatus,
} from "~/lib/system-check.js";
import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { quit } from "~/quit.js";
import { listVoices } from "~/services/yappr";
import { semantic } from "~/theme/semantic.js";
import type { ChatProvider, Preferences } from "~/types.js";
import { SpeechStep } from "./speech-step.js";

export interface SetupScreenProps {
  onDone: () => void;
}

type Step =
  | "welcome"
  | "deps"
  | "python"
  | "server"
  | "speech"
  | "voice"
  | "llm"
  | "done";

const STEP_ORDER: readonly Step[] = [
  "welcome",
  "deps",
  "python",
  "server",
  "speech",
  "voice",
  "llm",
  "done",
] as const;

const STEP_TITLES: Record<Step, string> = {
  welcome: "Welcome",
  deps: "System dependencies",
  python: "Python inference server",
  server: "Server reachability",
  speech: "Speech provider",
  voice: "Default voice",
  llm: "LLM provider",
  done: "All set",
};

const FOOTER_NEXT = { key: "Enter", label: "next" } as const;
const FOOTER_SKIP_ALL = { key: "Esc", label: "skip setup" } as const;
const FOOTER_SETUP = [FOOTER_NEXT, FOOTER_SKIP_ALL, footerQuit()];

export function SetupScreen({ onDone }: SetupScreenProps) {
  const { preferences, savePreferences } = usePreferences();
  const [step, setStep] = useState<Step>("welcome");
  const [voices, setVoices] = useState<readonly string[]>([]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = `Step ${stepIndex + 1} of ${STEP_ORDER.length}`;

  const advance = useCallback((to: Step) => setStep(to), []);

  const finish = useCallback(() => {
    savePreferences({ firstRunCompleted: true });
    onDone();
  }, [onDone, savePreferences]);

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: finish },
      { keys: [...DEFAULT_KEYS.quit], action: quit },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title={`Yappr setup — ${STEP_TITLES[step]}`}
        subtitle={`${progress} · Esc skips the rest`}
      />
      {step === "welcome" && <WelcomeStep onNext={() => advance("deps")} />}
      {step === "deps" && <DepsStep onNext={() => advance("python")} />}
      {step === "python" && <PythonStep onNext={() => advance("server")} />}
      {step === "server" && (
        <ServerStep
          onNext={(fetched) => {
            setVoices(fetched);
            advance("speech");
          }}
        />
      )}
      {step === "speech" && (
        <SpeechStep
          onPick={(choice) => {
            const updates: Partial<Preferences> = {
              voice: choice.voiceConfig,
            };
            if (choice.kind === "voxtral") {
              updates.defaultVoice = choice.defaultVoice;
            }
            savePreferences(updates);
            if (choice.kind === "yappr") advance("voice");
            else advance("llm");
          }}
          onSkip={() => advance("voice")}
        />
      )}
      {step === "voice" && (
        <VoiceStep
          voices={voices}
          current={preferences.defaultVoice}
          onPick={(voice) => {
            savePreferences({ defaultVoice: voice });
            advance("llm");
          }}
          onSkip={() => advance("llm")}
        />
      )}
      {step === "llm" && (
        <LlmStep
          initialProvider={preferences.defaultChatProvider}
          initialOllamaUrl={preferences.ollamaBaseUrl}
          initialOpenrouterKey={preferences.openrouterApiKey}
          onSave={(next) => {
            savePreferences(next);
            advance("done");
          }}
          onSkip={() => advance("done")}
        />
      )}
      {step === "done" && <DoneStep onFinish={finish} />}
      <Footer items={FOOTER_SETUP} />
    </Box>
  );
}

interface StepNextProps {
  onNext: () => void;
}

function WelcomeStep({ onNext }: StepNextProps) {
  useKeyboard({ bindings: [{ keys: ["return"], action: onNext }] });
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        This wizard will check system tooling, bootstrap the local Python
        inference server, and pick sensible defaults for voice + chat.
      </Text>
      <Text dimColor>Press Enter to begin. Esc skips at any point.</Text>
    </Box>
  );
}

function DepsStep({ onNext }: StepNextProps) {
  const [statuses] = useState<readonly SystemBinaryStatus[]>(() =>
    checkSystemBinaries(),
  );

  useKeyboard({ bindings: [{ keys: ["return"], action: onNext }] });

  const missing = statuses.filter((s) => !s.found);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {statuses.map((s) => (
        <Text key={s.name} color={s.found ? semantic.success : semantic.error}>
          {s.found ? "✓" : "✗"} {s.name}
          {s.found && s.path ? ` — ${s.path}` : ""}
        </Text>
      ))}
      {missing.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Install hints:</Text>
          {missing.map((s) => (
            <Text key={s.name} dimColor>
              {"  "}
              {s.name}: {s.installHint}
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Enter to continue (you can install later).</Text>
      </Box>
    </Box>
  );
}

const MAX_LOG_LINES = 12;

function PythonStep({ onNext }: StepNextProps) {
  const repoRoot = useMemo(() => findRepoRoot(), []);
  const [phase, setPhase] = useState<
    "checking" | "ready" | "syncing" | "synced" | "error"
  >(() => (repoRoot === null ? "error" : "checking"));
  const [log, setLog] = useState<readonly string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(() =>
    repoRoot === null
      ? "Could not locate yappr repo root (python/pyproject.toml)."
      : null,
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!repoRoot) return;
    // biome-ignore lint/suspicious/useIterableCallbackReturn: ResultAsync.map (neverthrow), not Array.map
    pythonVenvExists(repoRoot).map((exists) => {
      setPhase(exists ? "ready" : "syncing");
    });
  }, [repoRoot]);

  useEffect(() => {
    if (phase !== "syncing" || !repoRoot) return;
    const ac = new AbortController();
    abortRef.current = ac;
    runUvSync({
      repoRoot,
      onLine: (line) =>
        setLog((prev) => [...prev.slice(-MAX_LOG_LINES + 1), line]),
      signal: ac.signal,
    }).match(
      () => setPhase("synced"),
      (e) => {
        setErrMsg(e.message);
        setPhase("error");
      },
    );
    return () => ac.abort();
  }, [phase, repoRoot]);

  useKeyboard({
    bindings: [{ keys: ["return"], action: onNext }],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      {phase === "checking" && <Loading message="Checking Python venv..." />}
      {phase === "ready" && (
        <Text color={semantic.success}>
          ✓ python/.venv already present — no install needed.
        </Text>
      )}
      {phase === "syncing" && (
        <Box flexDirection="column">
          <Loading message="Running uv sync --extra dev (this can take a minute)..." />
          <Box flexDirection="column" marginTop={1}>
            {log.map((line, i) => (
              <Text key={i} dimColor>
                {line}
              </Text>
            ))}
          </Box>
        </Box>
      )}
      {phase === "synced" && (
        <Text color={semantic.success}>✓ Python env synced.</Text>
      )}
      {phase === "error" && errMsg && (
        <Box flexDirection="column">
          <Text color={semantic.error}>✗ {errMsg}</Text>
          <Text dimColor>
            You can fix this later by running `cd python && uv sync --extra
            dev`.
          </Text>
        </Box>
      )}
      {(phase === "ready" || phase === "synced" || phase === "error") && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter to continue.</Text>
        </Box>
      )}
    </Box>
  );
}

interface ServerStepProps {
  onNext: (voices: readonly string[]) => void;
}

function ServerStep({ onNext }: ServerStepProps) {
  const [attempt, setAttempt] = useState(0);
  const mutation = useMutation<readonly string[], Error, void>(() =>
    listVoices(),
  );

  useEffect(() => {
    mutation.mutate();
    // mutate is stable from useMutation; intentionally not in deps to avoid loop
  }, [attempt]);

  useKeyboard({
    bindings: [
      {
        keys: ["return"],
        action: () => {
          if (mutation.isSuccess && mutation.data) onNext(mutation.data);
        },
      },
      {
        keys: ["r"],
        action: () => setAttempt((n) => n + 1),
      },
      {
        keys: ["s"],
        action: () => onNext([]),
      },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      {mutation.isPending && (
        <Loading message="Calling /voices on the inference server..." />
      )}
      {mutation.isSuccess && (
        <Text color={semantic.success}>
          ✓ Server reachable — {mutation.data?.length ?? 0} voices available.
        </Text>
      )}
      {mutation.isError && mutation.error && (
        <Box flexDirection="column">
          <Text color={semantic.error}>✗ {mutation.error.message}</Text>
          <Text dimColor>
            Start the server in another terminal: `bun run start:py`
          </Text>
          <Text dimColor>(r) retry · (s) skip this step</Text>
        </Box>
      )}
      {mutation.isSuccess && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter to pick a voice.</Text>
        </Box>
      )}
    </Box>
  );
}

interface VoiceStepProps {
  voices: readonly string[];
  current: string;
  onPick: (voice: string) => void;
  onSkip: () => void;
}

function VoiceStep({ voices, current, onPick, onSkip }: VoiceStepProps) {
  const [index, setIndex] = useState(() =>
    Math.max(0, voices.indexOf(current)),
  );

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow"],
        action: () =>
          setIndex((i) =>
            voices.length === 0 ? 0 : (i - 1 + voices.length) % voices.length,
          ),
      },
      {
        keys: ["downArrow"],
        action: () =>
          setIndex((i) => (voices.length === 0 ? 0 : (i + 1) % voices.length)),
      },
      {
        keys: ["return"],
        action: () => {
          if (voices.length === 0) onSkip();
          else onPick(voices[index] ?? current);
        },
      },
    ],
  });

  if (voices.length === 0) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>
          Skipped — no voices fetched. Keeping current default: {current}
        </Text>
        <Text dimColor>Press Enter to continue.</Text>
      </Box>
    );
  }

  const visible = voices.slice(0, 10);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>↑/↓ to choose · Enter to confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((v, i) => (
          <Text key={v} color={i === index ? semantic.accent : undefined}>
            {listSelectionPrefix(i === index)}
            {v}
            {v === current ? " (current)" : ""}
          </Text>
        ))}
        {voices.length > visible.length && (
          <Text dimColor>… {voices.length - visible.length} more</Text>
        )}
      </Box>
    </Box>
  );
}

interface LlmStepProps {
  initialProvider: ChatProvider;
  initialOllamaUrl: string;
  initialOpenrouterKey: string;
  onSave: (next: {
    defaultChatProvider: ChatProvider;
    ollamaBaseUrl: string;
    openrouterApiKey: string;
  }) => void;
  onSkip: () => void;
}

type LlmSubStep = "provider" | "ollamaUrl" | "openrouterKey";

function LlmStep({
  initialProvider,
  initialOllamaUrl,
  initialOpenrouterKey,
  onSave,
  onSkip,
}: LlmStepProps) {
  const [provider, setProvider] = useState<ChatProvider>(initialProvider);
  const [ollamaUrl, setOllamaUrl] = useState(initialOllamaUrl);
  const [openrouterKey, setOpenrouterKey] = useState(initialOpenrouterKey);
  const [sub, setSub] = useState<LlmSubStep>("provider");

  const finishLlm = useCallback(() => {
    onSave({
      defaultChatProvider: provider,
      ollamaBaseUrl: ollamaUrl.trim() || "http://localhost:11434",
      openrouterApiKey: openrouterKey.trim(),
    });
  }, [onSave, provider, ollamaUrl, openrouterKey]);

  const providerBindings = useMemo(
    () =>
      sub === "provider"
        ? [
            {
              keys: ["tab"],
              action: () =>
                setProvider((p) => (p === "ollama" ? "openrouter" : "ollama")),
            },
            {
              keys: ["return"],
              action: () =>
                setSub(provider === "ollama" ? "ollamaUrl" : "openrouterKey"),
            },
            { keys: ["s"], action: onSkip },
          ]
        : [],
    [sub, provider, onSkip],
  );
  useKeyboard({ bindings: providerBindings });

  if (sub === "provider") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Tab toggles · Enter confirm · s skip step</Text>
        <Box marginTop={1}>
          <Text>Provider: </Text>
          <Text color={provider === "ollama" ? semantic.accent : undefined}>
            [Ollama]
          </Text>
          <Text> </Text>
          <Text color={provider === "openrouter" ? semantic.accent : undefined}>
            [OpenRouter]
          </Text>
        </Box>
      </Box>
    );
  }

  if (sub === "ollamaUrl") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Ollama base URL · Enter to save</Text>
        <Box marginTop={1}>
          <Text color={semantic.accent}>URL: </Text>
          <TextInput
            value={ollamaUrl}
            onChange={setOllamaUrl}
            onSubmit={finishLlm}
            placeholder="http://localhost:11434"
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>OpenRouter API key · Enter to save (blank = skip)</Text>
      <Box marginTop={1}>
        <Text color={semantic.accent}>Key: </Text>
        <TextInput
          value={openrouterKey}
          onChange={setOpenrouterKey}
          onSubmit={finishLlm}
          mask="*"
          placeholder="sk-or-..."
        />
      </Box>
    </Box>
  );
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  useKeyboard({ bindings: [{ keys: ["return"], action: onFinish }] });
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={semantic.success}>✓ Setup complete.</Text>
      <Text dimColor>
        Tip: set YAPPR_WHISPER_MODEL in your shell to switch the STT model (e.g.
        base.en). Defaults are tuned for short-clip accuracy.
      </Text>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to open the main menu.</Text>
      </Box>
    </Box>
  );
}
