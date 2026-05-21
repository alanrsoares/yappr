import type { ReactNode } from "react";

import type { AudioFormat, VoiceId } from "@yappr/sdk/schemas";
import { formatSpeed } from "@yappr/sdk/state";
import { VOXTRAL_MODEL_ID, VOXTRAL_VOICES } from "@yappr/sdk/voxtral-voices";
import { match } from "ts-pattern";

import { useInputDevices } from "~/hooks";
import { useVoiceStore, type VoiceStoreState } from "~/stores/voice";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Label } from "~/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/ui/sheet";
import { Slider } from "~/ui/slider";
import { useChatStore } from "../store";

interface ChatSettingsSheetProps {
  children: ReactNode;
}

/** Sentinel value used by the Select to represent "use system default mic"
 *  — radix Select disallows empty-string values, and `null` isn't a valid
 *  Select value, so we round-trip through this stable string. */
const INPUT_DEFAULT_SENTINEL = "__system_default__";

export function ChatSettingsSheet({ children }: ChatSettingsSheetProps) {
  const [
    { serverUrl, voiceConfig, voice, voices, speed, health, voiceReference },
    {
      setServerUrl,
      setSpeechKind,
      setSpeechModel,
      setSpeechFormat,
      setVoice,
      setSpeed,
      setVoiceReference,
      checkHealth,
    },
  ] = useVoiceStore();
  const [{ inputDeviceId }, { setInputDeviceId }] = useChatStore();
  const inputDevices = useInputDevices();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-[360px] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Inference server, voice, speech rate, and microphone input.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 px-4">
          <section className="space-y-2">
            <Label
              htmlFor="settings-speech-kind"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Speech endpoint
            </Label>
            <Select
              value={voiceConfig.speech.kind}
              onValueChange={(v) =>
                setSpeechKind(
                  v as VoiceStoreState["voiceConfig"]["speech"]["kind"],
                )
              }
            >
              <SelectTrigger
                id="settings-speech-kind"
                aria-label="Speech endpoint"
                className="font-mono text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent translate="no">
                <SelectItem value="yappr" className="font-mono text-sm">
                  Yappr local
                </SelectItem>
                <SelectItem
                  value="openai-compatible"
                  className="font-mono text-sm"
                >
                  OpenAI-compatible
                </SelectItem>
              </SelectContent>
            </Select>
            {voiceConfig.speech.kind === "openai-compatible" && (
              <p className="font-mono text-[0.65rem] text-muted-foreground">
                {voiceConfig.speech.model === VOXTRAL_MODEL_ID
                  ? "Preset: Voxtral 4B (vllm-omni). Edit model below to use a different OpenAI-compatible TTS."
                  : "Custom OpenAI-compatible endpoint. Set baseUrl + model + voice below."}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label
              htmlFor="settings-server-url"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Inference host
            </Label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void checkHealth();
              }}
              className="flex gap-2"
            >
              <Input
                id="settings-server-url"
                name="server-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="http://localhost:8000…"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={health.kind === "checking"}
              >
                {health.kind === "checking" ? "…" : "Check"}
              </Button>
            </form>
            <p className="font-mono text-[0.65rem] text-muted-foreground">
              {healthLine(health)}
            </p>
          </section>

          {voiceConfig.speech.kind === "openai-compatible" && (
            <>
              <section className="space-y-2">
                <Label
                  htmlFor="settings-speech-model"
                  className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
                >
                  Speech model
                </Label>
                <Input
                  id="settings-speech-model"
                  name="speech-model"
                  autoComplete="off"
                  spellCheck={false}
                  value={voiceConfig.speech.model}
                  onChange={(e) => setSpeechModel(e.target.value)}
                  className="font-mono text-sm"
                />
              </section>

              <section className="space-y-2">
                <Label
                  htmlFor="settings-audio-format"
                  className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
                >
                  Format
                </Label>
                <Select
                  value={voiceConfig.speech.format}
                  onValueChange={(v) => setSpeechFormat(v as AudioFormat)}
                >
                  <SelectTrigger
                    id="settings-audio-format"
                    aria-label="Audio format"
                    className="font-mono text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent translate="no">
                    {["wav", "mp3", "pcm", "flac", "opus"].map((format) => (
                      <SelectItem
                        key={format}
                        value={format}
                        className="font-mono text-sm"
                      >
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            </>
          )}

          <section className="space-y-2">
            <Label
              htmlFor="settings-voice"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Voice
            </Label>
            {voiceConfig.speech.kind === "openai-compatible" ? (
              voiceConfig.speech.model === VOXTRAL_MODEL_ID ? (
                <Select
                  value={voice}
                  onValueChange={(v) => setVoice(v as VoiceId)}
                >
                  <SelectTrigger
                    id="settings-voice"
                    aria-label="Voice"
                    className="font-mono text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent translate="no" className="max-h-72">
                    {VOXTRAL_VOICES.map((v) => (
                      <SelectItem
                        key={v}
                        value={v}
                        className="font-mono text-sm"
                      >
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="settings-voice"
                  name="voice"
                  autoComplete="off"
                  spellCheck={false}
                  value={voice}
                  onChange={(e) => setVoice(e.target.value as VoiceId)}
                  className="font-mono text-sm"
                />
              )
            ) : (
              <Select
                value={voice}
                onValueChange={(v) => setVoice(v as VoiceId)}
                disabled={voices.length === 0}
              >
                <SelectTrigger
                  id="settings-voice"
                  aria-label="Voice"
                  className="font-mono text-sm"
                >
                  <SelectValue placeholder="--- check host first ---" />
                </SelectTrigger>
                <SelectContent translate="no" className="max-h-72">
                  {voices.length === 0 ? (
                    <SelectItem value={voice} disabled>
                      --- check host first ---
                    </SelectItem>
                  ) : (
                    voices.map((v) => (
                      <SelectItem
                        key={v}
                        value={v}
                        className="font-mono text-sm"
                      >
                        {v}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </section>

          <section className="space-y-2">
            <Label
              htmlFor="settings-voice-ref-audio"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Voice reference (Dia only)
            </Label>
            <Input
              id="settings-voice-ref-audio"
              autoComplete="off"
              spellCheck={false}
              placeholder="/absolute/path/to/reference.wav"
              value={voiceReference?.audio_path ?? ""}
              onChange={(e) => {
                const audio_path = e.target.value.trim();
                const transcript = voiceReference?.transcript ?? "";
                setVoiceReference(
                  audio_path || transcript ? { audio_path, transcript } : null,
                );
              }}
              className="font-mono text-sm"
            />
            <Input
              autoComplete="off"
              spellCheck={false}
              placeholder="Exact transcript of the reference audio"
              value={voiceReference?.transcript ?? ""}
              onChange={(e) => {
                const transcript = e.target.value;
                const audio_path = voiceReference?.audio_path ?? "";
                setVoiceReference(
                  audio_path || transcript ? { audio_path, transcript } : null,
                );
              }}
              className="font-mono text-sm"
            />
            <p className="font-mono text-[0.65rem] text-muted-foreground">
              Clones the speaker in the reference WAV. Used by Dia; ignored by
              Kokoro / OpenAI-compatible.
            </p>
          </section>

          <section className="space-y-2">
            <Label
              htmlFor="settings-input-device"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Input device
            </Label>
            {!inputDevices.permissionGranted ? (
              <div className="space-y-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void inputDevices.requestPermission()}
                  className="w-full"
                >
                  Grant mic access
                </Button>
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  macOS will prompt once; labels appear after access is granted.
                </p>
              </div>
            ) : (
              <Select
                value={inputDeviceId ?? INPUT_DEFAULT_SENTINEL}
                onValueChange={(v) =>
                  setInputDeviceId(v === INPUT_DEFAULT_SENTINEL ? null : v)
                }
                disabled={inputDevices.devices.length === 0}
              >
                <SelectTrigger
                  id="settings-input-device"
                  aria-label="Input device"
                  className="font-mono text-sm"
                >
                  <SelectValue placeholder="System default" />
                </SelectTrigger>
                <SelectContent translate="no" className="max-h-72">
                  <SelectItem
                    value={INPUT_DEFAULT_SENTINEL}
                    className="font-mono text-sm"
                  >
                    System default
                  </SelectItem>
                  {inputDevices.devices.map((d) => (
                    <SelectItem
                      key={d.deviceId}
                      value={d.deviceId}
                      className="font-mono text-sm"
                    >
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label
                htmlFor="settings-speed"
                className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
              >
                Rate
              </Label>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {formatSpeed(speed)}
              </span>
            </div>
            <Slider
              id="settings-speed"
              aria-label="Speech rate"
              aria-valuetext={formatSpeed(speed)}
              value={[speed]}
              min={0.5}
              max={2}
              step={0.05}
              onValueChange={([next]) => {
                if (next !== undefined) setSpeed(next);
              }}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const healthLine = (health: VoiceStoreState["health"]): string => {
  return match(health)
    .with({ kind: "idle" }, () => "Not checked.")
    .with({ kind: "checking" }, () => "Probing…")
    .with({ kind: "ok" }, ({ voices }) => `Online — ${voices} voices.`)
    .with({ kind: "fail" }, ({ reason }) => `Error: ${reason}`)
    .exhaustive();
};
