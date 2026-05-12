import { useId } from "react";

import {
  Bay,
  BayCol,
  Deck,
  Footnote,
  InlineCode,
  Input,
  PitchHeader,
  PitchScale,
  PitchSection,
  PitchTitle,
  PitchValue,
  PlayKnob,
  Prompt,
  Reel,
  ScriptBay,
  SecondaryButton,
  SecondaryRow,
  Slot,
  SlotLabel,
  SlotValue,
  StripRow,
  TapeLabel,
  TapeWindow,
  Textarea,
  TransportBay,
} from "~/deck";
import { DEFAULT_VOICE, formatSpeed } from "~/lib/audio";
import { ReelSvg } from "~/screens/voice/components/reel";
import { VuMeterPair } from "~/screens/voice/components/vu-meter";
import { type VoiceId } from "~/services/yappr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/ui/select";
import { Slider } from "~/ui/slider";
import { HostStatus } from "./components/host-status";
import { useVoiceStore } from "./store";

export function VoiceScreen() {
  const voiceTriggerId = useId();
  const rateLabelId = useId();
  const {
    serverUrl,
    setServerUrl,
    health,
    voices,
    voice,
    setVoice,
    speed,
    setSpeed,
    text,
    setText,
    tts,
    audioElement,
    onCheckSubmit,
    checkHealth,
    stopAudio,
    speak,
  } = useVoiceStore();

  const isSpeaking = tts.kind === "speaking";
  const isHealthy = health.kind === "ok";
  const canSpeak =
    isHealthy && text.trim().length > 0 && !isSpeaking && voices.length > 0;
  const canStop = isSpeaking;

  return (
    <Deck>
      <Bay>
        <BayCol>
          <TapeWindow aria-hidden="true">
            <TapeLabel>METAL · STEREO · 60</TapeLabel>
            <Reel $active={isSpeaking}>
              <ReelSvg />
            </Reel>
            <Reel $active={isSpeaking}>
              <ReelSvg />
            </Reel>
          </TapeWindow>

          <PitchSection>
            <PitchHeader>
              <PitchTitle id={rateLabelId}>Pitch</PitchTitle>
              <PitchValue aria-live="polite">{formatSpeed(speed)}</PitchValue>
            </PitchHeader>
            <Slider
              aria-labelledby={rateLabelId}
              aria-valuetext={formatSpeed(speed)}
              value={[speed]}
              min={0.5}
              max={2.0}
              step={0.05}
              onValueChange={([next]) => {
                if (next !== undefined) setSpeed(next);
              }}
              className="
                  [&_[role=slider]]:bg-button-raised
                  [&_[role=slider]]:border-black/60
                  [&_[role=slider]]:shadow-button
                  [&_[role=slider]]:h-5
                  [&_[role=slider]]:w-5
                  [&_[role=slider]]:rounded-full
                  [&_[role=slider]]:focus-visible:ring-led-amber
                  [&_[role=slider]]:focus-visible:ring-1
                  [&>span:first-child]:h-1.5
                  [&>span:first-child]:bg-chassis-deep
                  [&>span:first-child]:shadow-bezel-deep
                  [&_[data-orientation=horizontal]>span]:bg-led-amber/70
                "
            />
            <PitchScale>
              <span>0.5×</span>
              <span>1.0×</span>
              <span>2.0×</span>
            </PitchScale>
          </PitchSection>
        </BayCol>

        <BayCol>
          <VuMeterPair audio={audioElement} />

          <TransportBay>
            <PlayKnob
              type="button"
              onClick={() => void speak()}
              disabled={!canSpeak}
              $variant={canSpeak ? "armed" : "idle"}
              aria-label="Play"
            >
              <span aria-hidden="true">▶</span>
            </PlayKnob>
            <SecondaryRow>
              <SecondaryButton
                type="button"
                onClick={stopAudio}
                disabled={!canStop}
                $variant="danger"
              >
                Stop
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => void checkHealth()}
                disabled={health.kind === "checking"}
              >
                {health.kind === "checking" ? "Probing…" : "Check"}
              </SecondaryButton>
            </SecondaryRow>
          </TransportBay>
        </BayCol>
      </Bay>

      <StripRow>
        <Slot>
          <SlotLabel htmlFor={voiceTriggerId}>Voice</SlotLabel>
          <SlotValue>
            <Select
              value={voice}
              onValueChange={(v) => setVoice(v as VoiceId)}
              disabled={voices.length === 0}
            >
              <SelectTrigger
                id={voiceTriggerId}
                aria-label="Voice"
                className="h-8 bg-chassis-deep border-black/70 text-led-amber font-lcd text-lg tracking-wider shadow-bezel-deep rounded-sm hover:bg-chassis-deep focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-0 [&>span]:line-clamp-none px-2 py-0"
              >
                <SelectValue placeholder="--- check host ---" />
              </SelectTrigger>
              <SelectContent
                translate="no"
                className="bg-panel border-black/70 text-foil shadow-bezel rounded-sm max-h-72"
              >
                {voices.length === 0 ? (
                  <SelectItem value={DEFAULT_VOICE} disabled>
                    --- check host first ---
                  </SelectItem>
                ) : (
                  voices.map((v) => (
                    <SelectItem
                      key={v}
                      value={v}
                      className="font-mono text-sm focus:bg-panel-edge focus:text-led-amber"
                    >
                      {v}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </SlotValue>
        </Slot>

        <Slot>
          <SlotLabel htmlFor="server-url">Source</SlotLabel>
          <SlotValue>
            <form
              onSubmit={onCheckSubmit}
              noValidate
              className="flex items-center gap-2"
            >
              <Input
                id="server-url"
                name="server-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="http://localhost:8000…"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="h-8"
              />
              <HostStatus state={health} />
            </form>
          </SlotValue>
        </Slot>
      </StripRow>

      <ScriptBay>
        <Prompt aria-hidden="true">{">"}</Prompt>
        <Textarea
          id="text"
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something to speak…"
          aria-label="Script"
        />
      </ScriptBay>

      <Footnote>
        Start the Python server in the repo root with{" "}
        <InlineCode translate="no">bun run serve</InlineCode>. CORS enabled on{" "}
        <InlineCode translate="no">127.0.0.1:8000</InlineCode>.
      </Footnote>
    </Deck>
  );
}
