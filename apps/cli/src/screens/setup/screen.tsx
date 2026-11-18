import { Effect } from "effect";
import { Box, Text } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Loading, ScreenShell } from "~/components";
import { FOOTER_SETUP } from "~/footer-items.js";
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
import type { Preferences } from "~/types.js";
import { LlmStep } from "./llm-step.js";
import { SpeechStep } from "./speech-step.js";
import { SttStep } from "./stt-step.js";

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
  | "stt"
  | "llm"
  | "done";

const STEP_ORDER: readonly Step[] = [
  "welcome",
  "deps",
  "python",
  "server",
  "speech",
  "voice",
  "stt",
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
  stt: "Speech-to-text & mic",
  llm: "LLM provider",
  done: "All set",
};

export function SetupScreen({ onDone }: SetupScreenProps) {
  const { preferences, savePreferences } = usePreferences();
  const [step, setStep] = useState<Step>("welcome");
  const [voices, setVoices] = useState<readonly string[]>([]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = `Step ${stepIndex + 1}/${STEP_ORDER.length}`;

  const advance = useCallback((to: Step) => setStep(to), []);

  const finish = useCallback(() => {
    savePreferences({ firstRunCompleted: true });
    onDone();
  }, [onDone, savePreferences]);

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: finish },
      { keys: ["ctrl+q"], action: quit },
    ],
  });

  return (
    <ScreenShell
      title="Setup"
      badge={progress}
      subtitle={STEP_TITLES[step]}
      footerItems={FOOTER_SETUP}
    >
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
              voice: {
                ...choice.voiceConfig,
                transcription: preferences.voice.transcription,
              },
            };
            if (choice.kind === "voxtral") {
              updates.defaultVoice = choice.defaultVoice;
            }
            savePreferences(updates);
            if (choice.kind === "yappr") advance("voice");
            else advance("stt");
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
            advance("stt");
          }}
          onSkip={() => advance("stt")}
        />
      )}
      {step === "stt" && (
        <SttStep
          initialTranscription={preferences.voice.transcription}
          initialDeviceIndex={preferences.defaultInputDeviceIndex}
          onSave={({ transcription, defaultInputDeviceIndex }) => {
            savePreferences({
              voice: {
                ...preferences.voice,
                transcription,
              },
              defaultInputDeviceIndex,
            });
            advance("llm");
          }}
          onSkip={() => advance("llm")}
        />
      )}
      {step === "llm" && (
        <LlmStep
          initialProvider={preferences.defaultChatProvider}
          initialModel={preferences.defaultChatModel}
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
    </ScreenShell>
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
    void Effect.runPromise(pythonVenvExists(repoRoot)).then((exists) => {
      setPhase(exists ? "ready" : "syncing");
    });
  }, [repoRoot]);

  useEffect(() => {
    if (phase !== "syncing" || !repoRoot) return;
    const ac = new AbortController();
    abortRef.current = ac;
    void Effect.runPromise(
      runUvSync({
        repoRoot,
        onLine: (line) =>
          setLog((prev) => [...prev.slice(-MAX_LOG_LINES + 1), line]),
        signal: ac.signal,
      }),
    ).then(
      () => setPhase("synced"),
      (e: unknown) => {
        setErrMsg(e instanceof Error ? e.message : String(e));
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

  const maxVisible = 10;
  const windowStart =
    voices.length <= maxVisible
      ? 0
      : Math.min(
          Math.max(0, index - Math.floor(maxVisible / 2)),
          voices.length - maxVisible,
        );
  const visible = voices.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>↑/↓ to choose · Enter to confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((v, i) => {
          const idx = windowStart + i;
          const selected = idx === index;
          return (
            <Text key={v} color={selected ? semantic.accent : undefined}>
              {listSelectionPrefix(selected)}
              {v}
              {v === current ? " (current)" : ""}
            </Text>
          );
        })}
        {voices.length > maxVisible && (
          <Text dimColor>
            Showing {windowStart + 1}–{windowStart + visible.length} of{" "}
            {voices.length}
          </Text>
        )}
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
