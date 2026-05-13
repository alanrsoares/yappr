import { Settings } from "lucide-react";

import { Button } from "~/app/ui/button";
import { SidebarTrigger } from "~/app/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/app/ui/tooltip";
import { DRAG, NO_DRAG } from "~/lib/drag-region";
import { useVoiceStore } from "~/stores/voice";
import { ChatSettingsSheet } from "./chat-settings-sheet";
import { ModelPicker } from "./model-picker";

interface ChatTopBarProps {
  model: string;
  onModelChange: (next: string) => void;
}

export function ChatTopBar({ model, onModelChange }: ChatTopBarProps) {
  const { health } = useVoiceStore();
  const isHealthy = health.kind === "ok";

  return (
    <header
      className={`flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 ${DRAG}`}
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

const healthLabel = (kind: "idle" | "checking" | "ok" | "fail"): string => {
  if (kind === "ok") return "online";
  if (kind === "checking") return "probing";
  if (kind === "fail") return "offline";
  return "idle";
};

const healthDescription = (
  kind: "idle" | "checking" | "ok" | "fail",
): string => {
  if (kind === "ok") return "Inference server reachable";
  if (kind === "checking") return "Probing inference server…";
  if (kind === "fail") return "Inference server unreachable — open Settings";
  return "Inference server not checked — open Settings to probe";
};
