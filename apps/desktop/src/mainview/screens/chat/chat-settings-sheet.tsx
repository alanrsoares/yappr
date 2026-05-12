import { type ReactNode } from "react";

import { type VoiceId } from "@yappr/sdk/schemas";
import { formatSpeed } from "@yappr/sdk/state";

import { useVoiceStore } from "~/lib/voice-store";
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

interface ChatSettingsSheetProps {
  children: ReactNode;
}

export function ChatSettingsSheet({ children }: ChatSettingsSheetProps) {
  const {
    serverUrl,
    setServerUrl,
    voice,
    setVoice,
    voices,
    speed,
    setSpeed,
    health,
    checkHealth,
  } = useVoiceStore();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-[360px] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Inference server, voice, and speech rate. Shared with the cassette
            deck at /voice.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 px-4">
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

          <section className="space-y-2">
            <Label
              htmlFor="settings-voice"
              className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground"
            >
              Voice
            </Label>
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
                    <SelectItem key={v} value={v} className="font-mono text-sm">
                      {v}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
              max={2.0}
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

const healthLine = (
  health: ReturnType<typeof useVoiceStore>["health"],
): string => {
  if (health.kind === "idle") return "Not checked.";
  if (health.kind === "checking") return "Probing…";
  if (health.kind === "ok") return `Online — ${health.voices} voices.`;
  return `Error: ${health.reason}`;
};
