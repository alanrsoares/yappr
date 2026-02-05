import { useRef, useState } from "react";
import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard, usePreferences } from "~/cli/hooks";
import { quit } from "~/cli/quit.js";
import { runListenStep } from "~/cli/services/yappr.js";

export interface ListenScreenProps {
  onBack: () => void;
}

type Phase = "idle" | "recording" | "processing" | "result";

export function ListenScreen({ onBack }: ListenScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { preferences } = usePreferences();

  const startRecording = () => {
    abortRef.current = new AbortController();
    setPhase("recording");
    setTranscript("");
    setResponse(null);
    setError(null);
    runListenStep({
      deviceIndex: preferences.defaultInputDeviceIndex,
      provider: preferences.defaultChatProvider,
      model: preferences.defaultChatModel,
      voice: preferences.defaultVoice,
      recordSignal: abortRef.current.signal,
      ollamaBaseUrl: preferences.ollamaBaseUrl || undefined,
      openrouterApiKey: preferences.openrouterApiKey || undefined,
      useNarrationForTTS: preferences.useNarrationForTTS,
      narrationModel: preferences.narrationModel || undefined,
    }).match(
      (res) => {
        setTranscript(res.transcript);
        setResponse(res.response);
        setError(res.error ?? null);
        setPhase("result");
      },
      (e) => {
        setError(e.message);
        setPhase("result");
      },
    );
  };

  const stopRecording = () => {
    if (abortRef.current && phase === "recording") {
      abortRef.current.abort();
      setPhase("processing");
    }
  };

  useKeyboard({
    bindings: [
      {
        keys: ["return", "enter"],
        action: () => {
          if (phase === "idle") startRecording();
          else if (phase === "recording") stopRecording();
        },
      },
      { keys: [...DEFAULT_KEYS.back], action: onBack },
      {
        keys: [...DEFAULT_KEYS.quit],
        action: () => {
          abortRef.current?.abort();
          quit();
        },
      },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Listen"
        subtitle="Enter = start recording, Enter again = stop & process"
      />
      {phase === "idle" && (
        <Text dimColor>
          Press Enter to start recording. (Device:{" "}
          {preferences.defaultInputDeviceIndex})
        </Text>
      )}
      {phase === "recording" && (
        <Box>
          <Text color="yellow">Recording... Press Enter to stop.</Text>
        </Box>
      )}
      {(phase === "processing" ||
        (phase === "result" && !transcript && !error)) && (
        <Loading message="Transcribing..." />
      )}
      {phase === "result" && transcript && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">You:</Text>
          <Text>{transcript}</Text>
          {response && (
            <>
              <Text color="green">Ollama:</Text>
              <Text>{response}</Text>
            </>
          )}
        </Box>
      )}
      {phase === "result" && error && <Text color="red">{error}</Text>}
      {phase === "result" && <Text dimColor>Press Enter to record again.</Text>}
      <Footer
        items={[
          { key: "Enter", label: phase === "recording" ? "stop" : "start" },
          { key: "Esc", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
