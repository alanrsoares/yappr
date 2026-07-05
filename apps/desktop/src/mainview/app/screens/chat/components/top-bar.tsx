import { Settings } from "lucide-react";
import { match } from "ts-pattern";

import { ModelPicker } from "~/app/components/model-picker";
import { DRAG, NO_DRAG } from "~/lib/drag-region";
import { useVoiceHealth } from "~/stores/voice";
import { Button } from "~/ui/button";
import { SidebarTrigger } from "~/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/ui/tooltip";
import { ChatSettingsSheet } from "./settings-sheet";

interface ChatTopBarProps {
  model: string;
  onModelChange: (next: string) => void;
}

export function ChatTopBar({ model, onModelChange }: ChatTopBarProps) {
  const { health } = useVoiceHealth();
  const isHealthy = health.kind === "ok";

  return (
    <header
      className={`flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm supports-backdrop-filter:bg-background/70 ${DRAG}`}
    >
      <div className={`flex flex-1 items-center gap-3 ${NO_DRAG}`}>
        <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
        <ModelPicker value={model} onChange={onModelChange} />
      </div>

      <div className={`flex items-center gap-3 ${NO_DRAG}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-widest"
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  isHealthy
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                    : "bg-amber-500/60"
                }`}
                aria-hidden="true"
              />
              <span className="hidden text-muted-foreground sm:inline">
                {healthLabel(health.kind)}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {healthDescription(health.kind)}
          </TooltipContent>
        </Tooltip>

        <ChatSettingsSheet>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="size-8"
          >
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        </ChatSettingsSheet>
      </div>
    </header>
  );
}

const healthLabel = (kind: "idle" | "checking" | "ok" | "fail"): string =>
  match(kind)
    .with("ok", () => "online")
    .with("checking", () => "probing")
    .with("fail", () => "offline")
    .with("idle", () => "idle")
    .exhaustive();

const healthDescription = (kind: "idle" | "checking" | "ok" | "fail"): string =>
  match(kind)
    .with("ok", () => "Inference server reachable")
    .with("checking", () => "Probing inference server…")
    .with("fail", () => "Inference server unreachable — open Settings")
    .with("idle", () => "Inference server not checked — open Settings to probe")
    .exhaustive();
