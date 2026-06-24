import { DEFAULT_SERVER_URL } from "@yappr/sdk/defaults";
import {
  type VoiceConfig,
  type VoiceConfigInput,
  VoiceConfigSchema,
} from "@yappr/sdk/schemas";
import {
  buildSpeechPreset,
  customOpenAiSpeechPreset,
  yapprSpeechPreset,
} from "@yappr/sdk/speech-presets";
import {
  VOXTRAL_DEFAULT_BASE_URL,
  VOXTRAL_DEFAULT_VOICE,
  VOXTRAL_VOICES,
} from "@yappr/sdk/voxtral-voices";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useMemo, useState } from "react";

import { useKeyboard } from "~/hooks";
import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { semantic } from "~/theme/semantic.js";

export type SpeechProviderChoice =
  | { kind: "yappr"; voiceConfig: VoiceConfig }
  | { kind: "voxtral"; voiceConfig: VoiceConfig; defaultVoice: string }
  | { kind: "custom"; voiceConfig: VoiceConfig };

interface SpeechStepProps {
  /** Called once the user has chosen + filled the form for their picked provider. */
  onPick: (choice: SpeechProviderChoice) => void;
  /** Called when the user taps Esc to skip speech-provider customisation. */
  onSkip: () => void;
}

type Phase = "select" | "voxtral-form" | "custom-form";

const OPTIONS: ReadonlyArray<{
  kind: "yappr" | "voxtral" | "custom";
  label: string;
  description: string;
}> = [
  {
    kind: "yappr",
    label: "Yappr local",
    description: "TTS + STT via the Python sidecar (Kokoro / Whisper).",
  },
  {
    kind: "voxtral",
    label: "Voxtral (remote vllm-omni)",
    description:
      "Mistral's Voxtral 4B served via a GPU box running `vllm serve --omni`.",
  },
  {
    kind: "custom",
    label: "Custom OpenAI-compatible",
    description:
      "Any provider that speaks `/v1/audio/speech` (Mistral cloud, ElevenLabs, …).",
  },
];

const TRANSCRIPTION_YAPPR: VoiceConfigInput["transcription"] = {
  kind: "yappr",
  baseUrl: DEFAULT_SERVER_URL,
};

const parseVoiceConfig = (input: VoiceConfigInput): VoiceConfig =>
  VoiceConfigSchema.parse(input);

export function SpeechStep({ onPick, onSkip }: SpeechStepProps) {
  const [phase, setPhase] = useState<Phase>("select");

  if (phase === "select") {
    return (
      <SelectPhase
        onPickYappr={() =>
          onPick({
            kind: "yappr",
            voiceConfig: parseVoiceConfig({
              speech: yapprSpeechPreset(),
              transcription: TRANSCRIPTION_YAPPR,
            }),
          })
        }
        onPickVoxtral={() => setPhase("voxtral-form")}
        onPickCustom={() => setPhase("custom-form")}
        onSkip={onSkip}
      />
    );
  }

  if (phase === "voxtral-form") {
    return <VoxtralForm onDone={onPick} onCancel={() => setPhase("select")} />;
  }

  return <CustomForm onDone={onPick} onCancel={() => setPhase("select")} />;
}

interface SelectPhaseProps {
  onPickYappr: () => void;
  onPickVoxtral: () => void;
  onPickCustom: () => void;
  onSkip: () => void;
}

function SelectPhase({
  onPickYappr,
  onPickVoxtral,
  onPickCustom,
  onSkip,
}: SelectPhaseProps) {
  const [index, setIndex] = useState(0);

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow"],
        action: () =>
          setIndex((i) => (i - 1 + OPTIONS.length) % OPTIONS.length),
      },
      {
        keys: ["downArrow"],
        action: () => setIndex((i) => (i + 1) % OPTIONS.length),
      },
      {
        keys: ["s"],
        action: onSkip,
      },
      {
        keys: ["return"],
        action: () => {
          const chosen = OPTIONS[index]?.kind ?? "yappr";
          if (chosen === "yappr") onPickYappr();
          else if (chosen === "voxtral") onPickVoxtral();
          else onPickCustom();
        },
      },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>↑/↓ to choose · Enter to confirm · s to skip</Text>
      <Box flexDirection="column" marginTop={1}>
        {OPTIONS.map((opt, i) => {
          const selected = i === index;
          return (
            <Box key={opt.kind} flexDirection="column" marginBottom={0}>
              <Text color={selected ? semantic.accent : undefined}>
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

interface VoxtralFormProps {
  onDone: (choice: SpeechProviderChoice) => void;
  onCancel: () => void;
}

function VoxtralForm({ onDone, onCancel }: VoxtralFormProps) {
  const [baseUrl, setBaseUrl] = useState(VOXTRAL_DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [voiceIndex, setVoiceIndex] = useState(() =>
    Math.max(0, VOXTRAL_VOICES.indexOf(VOXTRAL_DEFAULT_VOICE)),
  );
  const [focused, setFocused] = useState<"baseUrl" | "apiKey" | "voice">(
    "baseUrl",
  );

  const submit = () => {
    const chosenVoice = VOXTRAL_VOICES[voiceIndex] ?? VOXTRAL_DEFAULT_VOICE;
    const preset = buildSpeechPreset("voxtral", {
      baseUrl: baseUrl.trim() || VOXTRAL_DEFAULT_BASE_URL,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      voice: chosenVoice,
    });
    onDone({
      kind: "voxtral",
      defaultVoice: chosenVoice,
      voiceConfig: parseVoiceConfig({
        speech: preset,
        transcription: TRANSCRIPTION_YAPPR,
      }),
    });
  };

  useKeyboard({
    bindings: [
      { keys: ["tab"], action: () => cycle(focused, setFocused) },
      { keys: ["escape"], action: onCancel },
      {
        keys: ["upArrow"],
        action: () => {
          if (focused !== "voice") return;
          setVoiceIndex(
            (i) => (i - 1 + VOXTRAL_VOICES.length) % VOXTRAL_VOICES.length,
          );
        },
      },
      {
        keys: ["downArrow"],
        action: () => {
          if (focused !== "voice") return;
          setVoiceIndex((i) => (i + 1) % VOXTRAL_VOICES.length);
        },
      },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        Tab to move between fields · Enter to confirm · Esc to go back
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Field
          label="vllm baseUrl"
          value={baseUrl}
          focused={focused === "baseUrl"}
          onChange={setBaseUrl}
          onSubmit={() => setFocused("apiKey")}
        />
        <Field
          label="API key (optional)"
          value={apiKey}
          focused={focused === "apiKey"}
          onChange={setApiKey}
          onSubmit={() => setFocused("voice")}
          mask
        />
        <Box flexDirection="column" marginTop={1}>
          <Text color={focused === "voice" ? semantic.accent : undefined}>
            Voice: {VOXTRAL_VOICES[voiceIndex] ?? VOXTRAL_DEFAULT_VOICE}
          </Text>
          {focused === "voice" ? (
            <Text dimColor>↑/↓ to change voice · Enter to confirm</Text>
          ) : (
            <Text dimColor>Tab to highlight voice</Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <SubmitHint focused={focused} onSubmit={submit} />
      </Box>
    </Box>
  );
}

interface CustomFormProps {
  onDone: (choice: SpeechProviderChoice) => void;
  onCancel: () => void;
}

function CustomForm({ onDone, onCancel }: CustomFormProps) {
  const [baseUrl, setBaseUrl] = useState("https://api.example.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [focused, setFocused] = useState<
    "baseUrl" | "apiKey" | "model" | "voice"
  >("baseUrl");

  const fields = useMemo(
    () => ["baseUrl", "apiKey", "model", "voice"] as const,
    [],
  );

  const submit = () => {
    if (!baseUrl.trim() || !model.trim() || !voice.trim()) return;
    onDone({
      kind: "custom",
      voiceConfig: parseVoiceConfig({
        speech: customOpenAiSpeechPreset({
          baseUrl: baseUrl.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          model: model.trim(),
          voice: voice.trim(),
        }),
        transcription: TRANSCRIPTION_YAPPR,
      }),
    });
  };

  useKeyboard({
    bindings: [
      {
        keys: ["tab"],
        action: () => {
          const i = fields.indexOf(focused);
          const next = fields[(i + 1) % fields.length];
          if (next) setFocused(next);
        },
      },
      { keys: ["escape"], action: onCancel },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        Tab to move between fields · Enter to advance · Esc to go back
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Field
          label="baseUrl"
          value={baseUrl}
          focused={focused === "baseUrl"}
          onChange={setBaseUrl}
          onSubmit={() => setFocused("apiKey")}
        />
        <Field
          label="API key (optional)"
          value={apiKey}
          focused={focused === "apiKey"}
          onChange={setApiKey}
          onSubmit={() => setFocused("model")}
          mask
        />
        <Field
          label="model"
          value={model}
          focused={focused === "model"}
          onChange={setModel}
          onSubmit={() => setFocused("voice")}
        />
        <Field
          label="voice id"
          value={voice}
          focused={focused === "voice"}
          onChange={setVoice}
          onSubmit={submit}
        />
      </Box>
      <Box marginTop={1}>
        <SubmitHint focused={focused} onSubmit={submit} />
      </Box>
    </Box>
  );
}

interface FieldProps {
  label: string;
  value: string;
  focused: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mask?: boolean;
}

function Field({
  label,
  value,
  focused,
  onChange,
  onSubmit,
  mask,
}: FieldProps) {
  return (
    <Box flexDirection="row" marginBottom={0}>
      <Box width={20}>
        <Text color={focused ? semantic.accent : undefined}>
          {focused ? "› " : "  "}
          {label}
        </Text>
      </Box>
      {focused ? (
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          mask={mask ? "•" : undefined}
        />
      ) : (
        <Text dimColor>{mask ? "•".repeat(value.length || 0) : value}</Text>
      )}
    </Box>
  );
}

interface SubmitHintProps {
  focused: string;
  onSubmit: () => void;
}

function SubmitHint({ focused, onSubmit }: SubmitHintProps) {
  useKeyboard({
    bindings: [{ keys: ["ctrl+s"], action: onSubmit }],
  });
  return (
    <Text dimColor>
      Currently editing: {focused} · ctrl+s submits the whole form
    </Text>
  );
}

function cycle<T extends string>(current: T, setter: (next: T) => void): void {
  // SelectPhase has no cycle — this helper is consumed by VoxtralForm only,
  // which has a fixed 3-field rotation.
  const order: readonly string[] = ["baseUrl", "apiKey", "voice"];
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length] as T;
  setter(next);
}
