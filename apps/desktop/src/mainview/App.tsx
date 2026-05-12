import { useState } from "react";

import {
  Button,
  Card,
  Container,
  ControlRow,
  Hint,
  InlineCode,
  Input,
  Label,
  Shell,
  StatusBadge,
  Subtitle,
  Title,
} from "./ui";

const DEFAULT_SERVER_URL = "http://localhost:8000";

type HealthState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; voices: number }
  | { kind: "fail"; reason: string };

function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [health, setHealth] = useState<HealthState>({ kind: "idle" });

  async function checkHealth() {
    setHealth({ kind: "checking" });
    try {
      const res = await fetch(`${serverUrl}/voices`, { method: "GET" });
      if (!res.ok) {
        setHealth({ kind: "fail", reason: `HTTP ${res.status}` });
        return;
      }
      const data = (await res.json()) as { voices?: unknown[] };
      setHealth({ kind: "ok", voices: data.voices?.length ?? 0 });
    } catch (err) {
      setHealth({
        kind: "fail",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <Shell>
      <Container>
        <Title>Yappr</Title>
        <Subtitle>
          Desktop spike — Phase 0 (health check only, no spawn yet)
        </Subtitle>

        <Card>
          <Label htmlFor="server-url">Inference server URL</Label>
          <Input
            id="server-url"
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />

          <ControlRow>
            <Button onClick={checkHealth} disabled={health.kind === "checking"}>
              {health.kind === "checking" ? "Checking…" : "Check health"}
            </Button>
            <HealthStatus state={health} />
          </ControlRow>
        </Card>

        <Hint>
          <p>
            Start the Python server first:{" "}
            <InlineCode>bun run serve</InlineCode> in the repo root.
          </p>
          <p>
            This spike validates the webview → Python contract. Spawning the
            server from inside the desktop app comes after the packaged-path
            resolution PoC.
          </p>
        </Hint>
      </Container>
    </Shell>
  );
}

function HealthStatus({ state }: { state: HealthState }) {
  if (state.kind === "idle") {
    return <StatusBadge $state="idle">Not checked</StatusBadge>;
  }
  if (state.kind === "checking") {
    return <StatusBadge $state="checking">…</StatusBadge>;
  }
  if (state.kind === "ok") {
    return (
      <StatusBadge $state="ok">● Connected ({state.voices} voices)</StatusBadge>
    );
  }
  return <StatusBadge $state="fail">● {state.reason}</StatusBadge>;
}

export default App;
