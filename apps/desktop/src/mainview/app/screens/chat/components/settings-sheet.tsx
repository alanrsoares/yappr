import type { ReactNode } from "react";

import type { VoiceId } from "@yappr/sdk/schemas";
import { formatSpeed } from "@yappr/sdk/state";
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
    { serverUrl, voice, voices, speed, health },
    { setServerUrl, setVoice, setSpeed, checkHealth },
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
