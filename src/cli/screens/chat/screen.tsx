import { useCallback, useRef, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { okAsync } from "neverthrow";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, useMutation, usePreferences } from "~/cli/hooks";
import { chat, recordAndTranscribe, speak } from "~/cli/services/yappr.js";

type ChatPhase = "idle" | "thinking" | "speaking";
type SttPhase = "idle" | "recording" | "transcribing";

export interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [hasStoppedRecording, setHasStoppedRecording] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { preferences } = usePreferences();
  const model = preferences.defaultOllamaModel;
  const voice = preferences.defaultVoice;

  const chatMutation = useMutation<string | null, Error, string>((prompt) => {
    setPhase("thinking");
    return chat(prompt, { model })
      .andThen((text) => {
        if (!text) {
          setPhase("idle");
          return okAsync(null);
        }
        setPhase("speaking");
        return speak(text, { voice }).map(() => text);
      })
      .andTee(() => setPhase("idle"))
      .orTee(() => setPhase("idle"));
  });
  const { mutate, data: response, error, isPending } = chatMutation;

  const appendTranscript = useCallback((transcript: string) => {
    if (transcript) {
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, []);

  const sttMutation = useMutation<string, Error, AbortSignal>(
    (recordSignal) =>
      recordAndTranscribe({
        deviceIndex: preferences.defaultInputDeviceIndex,
        recordSignal,
      }),
    { onSuccess: appendTranscript },
  );

  const sttPhase: SttPhase = !sttMutation.isPending
    ? "idle"
    : hasStoppedRecording
      ? "transcribing"
      : "recording";

  const startStt = useCallback(() => {
    if (isPending || sttMutation.isPending || sttPhase !== "idle") return;
    sttMutation.reset();
    setHasStoppedRecording(false);
    abortRef.current = new AbortController();
    sttMutation.mutate(abortRef.current.signal);
  }, [isPending, sttPhase, sttMutation]);

  const stopStt = useCallback(() => {
    if (abortRef.current && sttPhase === "recording") {
      abortRef.current.abort();
      setHasStoppedRecording(true);
    }
  }, [sttPhase]);

  const handleSubmit = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      sttMutation.reset();
      mutate(prompt.trim());
      setValue("");
    },
    [mutate, sttMutation],
  );

  useKeyboard({
    bindings: [
      {
        keys: ["v"],
        action: () => {
          if (sttPhase === "idle") startStt();
          else if (sttPhase === "recording") stopStt();
        },
      },
      { keys: ["escape"], action: onBack },
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
    ],
  });

  const hasResponse = chatMutation.isSuccess && response !== undefined;
  const showError = chatMutation.isError && error;

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Chat"
        subtitle={`Model: ${model}  ·  Voice: ${voice}`}
      />

      <Box
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
        minHeight={3}
        flexDirection="column"
        marginBottom={1}
      >
        {isPending && phase === "thinking" && (
          <Loading message="Thinking…" />
        )}
        {isPending && phase === "speaking" && (
          <Loading message="Speaking…" />
        )}
        {!isPending && sttPhase === "recording" && (
          <Text color="yellow">Recording… Press v to stop.</Text>
        )}
        {!isPending && sttPhase === "transcribing" && (
          <Loading message="Transcribing…" />
        )}
        {!isPending && sttPhase === "idle" && sttMutation.error && (
          <Text color="red">STT: {sttMutation.error.message}</Text>
        )}
        {!isPending &&
          sttPhase === "idle" &&
          !sttMutation.error &&
          hasResponse && (
          <Box flexDirection="column">
            <Text dimColor>Response:</Text>
            <Text>{response ?? "(no response)"}</Text>
          </Box>
        )}
        {!isPending &&
          sttPhase === "idle" &&
          !sttMutation.error &&
          showError && (
          <Text color="red">{error?.message}</Text>
        )}
        {!isPending &&
          sttPhase === "idle" &&
          !sttMutation.error &&
          !hasResponse &&
          !showError && (
            <Text dimColor>
              Type or press v for voice — reply is read aloud with TTS.
            </Text>
          )}
      </Box>

      <Box flexDirection="row" alignItems="center">
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={`Ask ${model}… or press v`}
        />
      </Box>

      <Footer
        items={[
          { key: "v", label: "voice" },
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
