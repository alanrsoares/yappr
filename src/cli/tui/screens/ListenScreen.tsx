import { useRef, useState } from "react";

import { Box, Text } from "ink";

import { Footer, Header, Loading } from "../components/index.js";
import { DEFAULT_KEYS } from "../constants.js";
import { useKeyboard } from "../hooks/index.js";
import { runListenStep } from "../services/yappr.js";

export interface ListenScreenProps {
  onBack: () => void;
}

type Phase = "idle" | "recording" | "processing" | "result";

export function ListenScreen({ onBack }: ListenScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceIndex, _setDeviceIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const startRecording = () => {
    abortRef.current = new AbortController();
    setPhase("recording");
    setTranscript("");
    setResponse(null);
    setError(null);
    runListenStep({
      deviceIndex,
      recordSignal: abortRef.current.signal,
    })
      .then((res) => {
        setTranscript(res.transcript);
        setResponse(res.response);
        setError(res.error ?? null);
        setPhase("result");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("result");
      });
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
      { keys: [...DEFAULT_KEYS.quit], action: () => process.exit(0) },
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
          Press Enter to start recording. (Device: {deviceIndex})
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
          { key: "b", label: "back" },
          { key: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
