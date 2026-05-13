import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2, Mic, Square } from "lucide-react";

import { cn } from "~/lib/utils";
import { blobToWavBlob } from "~/lib/wav";
import { Button } from "~/ui/button";
import { PromptInputAction } from "~/ui/prompt-input";

// Heuristic thresholds for short-circuiting before the server roundtrip.
// Whisper hallucinates "You" / "Thank you" on near-silent or sub-second clips.
const MIN_DURATION_SEC = 0.4;
const SILENCE_RMS = 0.004;

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

type MicState =
  | { kind: "idle" }
  | { kind: "recording"; stop: () => Promise<Blob> }
  | { kind: "processing" }
  | { kind: "error"; reason: string };

interface MicButtonProps {
  /** Called with the transcribed text when recording stops cleanly. */
  onTranscript: (text: string) => void;
  /** Resolves the recorded blob to text. Provided by the voice store. */
  transcribe: (blob: Blob) => Promise<string>;
  /** Disable while another action (send/stop) is in flight. */
  disabled?: boolean;
  /** MediaDevices deviceId to capture from. `null`/undefined = system default. */
  inputDeviceId?: string | null;
}

/**
 * Click-to-toggle dictation. Uses MediaRecorder + the Python /transcribe
 * endpoint via the voice store. The recorded clip is decoded to a 16-bit PCM
 * WAV in the webview before upload — Whisper hallucinates single words
 * ("You", "Thank you") when handed WebKit's mp4/AAC through ffmpeg, so we
 * skip that path entirely. Appends the transcript to the composer draft via
 * `onTranscript`. Errors surface as a tooltip on the next idle render.
 */
export function MicButton({
  onTranscript,
  transcribe,
  disabled,
  inputDeviceId,
}: MicButtonProps) {
  const [state, setState] = useState<MicState>({ kind: "idle" });
  const streamRef = useRef<MediaStream | null>(null);

  // Always release the mic on unmount, even mid-recording.
  useEffect(() => {
    return () => releaseStream(streamRef.current);
  }, []);

  const start = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: pickMimeType(),
      });
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      });

      const stoppedPromise = new Promise<Blob>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => resolve(new Blob(chunks, { type: recorder.mimeType })),
          { once: true },
        );
      });

      recorder.start();
      setState({
        kind: "recording",
        stop: async () => {
          recorder.stop();
          return stoppedPromise;
        },
      });
    } catch (err) {
      setState({
        kind: "error",
        reason: err instanceof Error ? err.message : "Mic unavailable",
      });
    }
  }, [inputDeviceId]);

  const stop = useCallback(async () => {
    if (state.kind !== "recording") return;
    const recorded = await state.stop();
    releaseStream(streamRef.current);
    streamRef.current = null;
    setState({ kind: "processing" });
    try {
      // Decode to 16-bit PCM WAV before upload — see file header above.
      const { wav, durationSec, rms } = await blobToWavBlob(recorded);

      if (durationSec < MIN_DURATION_SEC) {
        setState({
          kind: "error",
          reason: `Too short (${durationSec.toFixed(1)}s) — speak ~1s+`,
        });
        return;
      }
      if (rms < SILENCE_RMS) {
        setState({
          kind: "error",
          reason: `Silent input (rms ${rms.toFixed(3)}) — mic muted or no speech`,
        });
        return;
      }

      const text = await transcribe(wav);
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setState({
          kind: "error",
          reason: "Whisper returned empty — try a longer, clearer phrase",
        });
        return;
      }
      onTranscript(trimmed);
      setState({ kind: "idle" });
    } catch (err) {
      console.error("[mic] error:", err);
      setState({
        kind: "error",
        reason: err instanceof Error ? err.message : "Transcription failed",
      });
    }
  }, [state, transcribe, onTranscript]);

  const onClick = state.kind === "recording" ? stop : start;
  const isBusy = state.kind === "processing";

  const label =
    state.kind === "recording"
      ? "Stop dictation"
      : state.kind === "processing"
        ? "Transcribing…"
        : state.kind === "error"
          ? `Mic error — ${state.reason}`
          : "Start dictation";

  return (
    <PromptInputAction tooltip={label} side="top">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => void onClick()}
        disabled={disabled || isBusy}
        aria-label={label}
        className={cn(
          "size-8",
          state.kind === "recording" &&
            "text-led-red animate-pulse motion-reduce:animate-none",
          state.kind === "error" && "text-destructive",
        )}
      >
        {state.kind === "recording" ? (
          <Square className="size-3.5" aria-hidden="true" />
        ) : state.kind === "processing" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="size-4" aria-hidden="true" />
        )}
      </Button>
    </PromptInputAction>
  );
}

function pickMimeType(): string | undefined {
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function releaseStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}
