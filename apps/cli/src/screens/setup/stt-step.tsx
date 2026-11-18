import { DEFAULT_SERVER_URL } from "@yappr/sdk/defaults";
import {
  type TranscriptionEndpoint,
  TranscriptionEndpointSchema,
} from "@yappr/sdk/schemas";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useMemo, useState } from "react";

import { Loading } from "~/components";
import { useKeyboard, useQuery } from "~/hooks";
import { clampSelectedIndex, cycleIndex } from "~/list-nav.js";
import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { type AudioDevice, listInputDevices } from "~/services/yappr";
import { semantic } from "~/theme/semantic.js";

export interface SttStepProps {
  initialTranscription: TranscriptionEndpoint;
  initialDeviceIndex: number;
  onSave: (next: {
    transcription: TranscriptionEndpoint;
    defaultInputDeviceIndex: number;
  }) => void;
  onSkip: () => void;
}

type Phase = "provider" | "custom-form" | "device";

const STT_OPTIONS: ReadonlyArray<{
  kind: "yappr" | "openai-compatible";
  label: string;
  description: string;
}> = [
  {
    kind: "yappr",
    label: "Yappr local (Whisper)",
    description: "Transcribe locally via the Python sidecar (faster-whisper).",
  },
  {
    kind: "openai-compatible",
    label: "OpenAI-compatible",
    description: "Remote /v1/audio/transcriptions (OpenAI, Groq, Mistral, …).",
  },
];

const CUSTOM_FIELDS = ["baseUrl", "apiKey", "model"] as const;
type CustomField = (typeof CUSTOM_FIELDS)[number];

export function SttStep({
  initialTranscription,
  initialDeviceIndex,
  onSave,
  onSkip,
}: SttStepProps) {
  const [phase, setPhase] = useState<Phase>("provider");
  const [transcription, setTranscription] =
    useState<TranscriptionEndpoint>(initialTranscription);

  if (phase === "provider") {
    return (
      <SelectProviderPhase
        initial={initialTranscription.kind}
        onPickYappr={() => {
          setTranscription(
            TranscriptionEndpointSchema.parse({
              kind: "yappr",
              baseUrl: DEFAULT_SERVER_URL,
            }),
          );
          setPhase("device");
        }}
        onPickCustom={() => setPhase("custom-form")}
        onSkip={onSkip}
      />
    );
  }

  if (phase === "custom-form") {
    return (
      <CustomSttForm
        initial={
          initialTranscription.kind === "openai-compatible"
            ? initialTranscription
            : undefined
        }
        onDone={(endpoint) => {
          setTranscription(endpoint);
          setPhase("device");
        }}
        onBack={() => setPhase("provider")}
      />
    );
  }

  return (
    <SelectDevicePhase
      initialDeviceIndex={initialDeviceIndex}
      onPick={(deviceIndex) =>
        onSave({
          transcription,
          defaultInputDeviceIndex: deviceIndex,
        })
      }
      onBack={() =>
        setPhase(
          transcription.kind === "openai-compatible"
            ? "custom-form"
            : "provider",
        )
      }
    />
  );
}

function SelectProviderPhase({
  initial,
  onPickYappr,
  onPickCustom,
  onSkip,
}: {
  initial: TranscriptionEndpoint["kind"];
  onPickYappr: () => void;
  onPickCustom: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      STT_OPTIONS.findIndex((o) => o.kind === initial),
    ),
  );

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () => setIndex((i) => cycleIndex(i, STT_OPTIONS.length, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () => setIndex((i) => cycleIndex(i, STT_OPTIONS.length, 1)),
      },
      {
        keys: ["return"],
        action: () => {
          const chosen = STT_OPTIONS[index]?.kind ?? "yappr";
          if (chosen === "yappr") onPickYappr();
          else onPickCustom();
        },
      },
      { keys: ["s"], action: onSkip },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>↑/↓ choose · Enter configure · s skip step</Text>
      <Box flexDirection="column" marginTop={1}>
        {STT_OPTIONS.map((opt, i) => {
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

function CustomSttForm({
  initial,
  onDone,
  onBack,
}: {
  initial?: Extract<TranscriptionEndpoint, { kind: "openai-compatible" }>;
  onDone: (endpoint: TranscriptionEndpoint) => void;
  onBack: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(
    initial?.baseUrl ?? "https://api.openai.com/v1",
  );
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [model, setModel] = useState(initial?.model ?? "whisper-1");
  const [focused, setFocused] = useState<CustomField>("baseUrl");
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () => {
    const parsed = TranscriptionEndpointSchema.safeParse({
      kind: "openai-compatible",
      baseUrl: baseUrl.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      model: model.trim(),
    });
    if (!parsed.success) {
      setFormError("Enter a valid URL and model name.");
      return;
    }
    setFormError(null);
    onDone(parsed.data);
  };

  useKeyboard({
    bindings: [
      {
        keys: ["tab"],
        action: () => {
          const i = CUSTOM_FIELDS.indexOf(focused);
          setFocused(CUSTOM_FIELDS[(i + 1) % CUSTOM_FIELDS.length]!);
        },
      },
      { keys: ["ctrl+s"], action: submit },
      { keys: ["ctrl+b"], action: onBack },
    ],
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        Tab next field · Enter advance · Ctrl+S save · Ctrl+B back
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <SttField
          label="Base URL"
          value={baseUrl}
          focused={focused === "baseUrl"}
          onChange={setBaseUrl}
          onSubmit={() => setFocused("apiKey")}
        />
        <SttField
          label="API key (opt)"
          value={apiKey}
          focused={focused === "apiKey"}
          onChange={setApiKey}
          onSubmit={() => setFocused("model")}
          mask
        />
        <SttField
          label="Model"
          value={model}
          focused={focused === "model"}
          onChange={setModel}
          onSubmit={submit}
        />
      </Box>
      {formError !== null && (
        <Box marginTop={1}>
          <Text color={semantic.error}>✗ {formError}</Text>
        </Box>
      )}
    </Box>
  );
}

function SttField({
  label,
  value,
  focused,
  onChange,
  onSubmit,
  mask,
}: {
  label: string;
  value: string;
  focused: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mask?: boolean;
}) {
  return (
    <Box flexDirection="row">
      <Box width={18}>
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
        <Text dimColor>{mask ? "•".repeat(value.length) : value}</Text>
      )}
    </Box>
  );
}

function SelectDevicePhase({
  initialDeviceIndex,
  onPick,
  onBack,
}: {
  initialDeviceIndex: number;
  onPick: (deviceIndex: number) => void;
  onBack: () => void;
}) {
  const {
    data: devices = [],
    isLoading,
    error,
  } = useQuery<readonly AudioDevice[], Error>(listInputDevices);

  const initialIdx = useMemo(
    () =>
      Math.max(
        0,
        devices.findIndex((d) => d.index === initialDeviceIndex),
      ),
    [devices, initialDeviceIndex],
  );
  const [index, setIndex] = useState(initialIdx);
  const effectiveIndex = clampSelectedIndex(index, devices.length);

  useKeyboard({
    bindings: [
      {
        keys: ["upArrow", "k"],
        action: () => setIndex((i) => cycleIndex(i, devices.length, -1)),
      },
      {
        keys: ["downArrow", "j"],
        action: () => setIndex((i) => cycleIndex(i, devices.length, 1)),
      },
      {
        keys: ["return"],
        action: () => {
          const chosen = devices[effectiveIndex];
          onPick(chosen ? chosen.index : initialDeviceIndex);
        },
      },
      { keys: ["ctrl+b"], action: onBack },
    ],
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Loading message="Scanning audio input devices…" />
      </Box>
    );
  }

  if (error || devices.length === 0) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={error ? semantic.error : undefined} dimColor={!error}>
          {error
            ? `✗ Could not list input devices: ${error.message}`
            : "No input devices found."}
        </Text>
        <Text dimColor>
          Keeping device index {initialDeviceIndex}. Enter to continue · Ctrl+B
          back.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        Select microphone · ↑/↓ choose · Enter confirm · Ctrl+B back
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {devices.map((d, i) => {
          const selected = i === effectiveIndex;
          return (
            <Text
              key={`${d.index}-${d.name}`}
              color={selected ? semantic.accent : undefined}
              bold={selected}
            >
              {listSelectionPrefix(selected)}[{d.index}] {d.name}
              {d.index === initialDeviceIndex ? " (current)" : ""}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
