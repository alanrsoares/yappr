import { Lcd, LcdFrame } from "~/deck";
import { formatVoiceCount } from "~/lib/audio";
import type { HealthState } from "~/types";

export const HostStatus = ({ state }: { state: HealthState }) => (
  <LcdFrame
    className="shrink-0 min-w-[100px]"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <Lcd $state={state.kind === "idle" ? "dim" : "on"}>
      {hostStatusText(state)}
    </Lcd>
  </LcdFrame>
);

const hostStatusText = (state: HealthState): string => {
  if (state.kind === "idle") return "— idle —";
  if (state.kind === "checking") return "probing…";
  if (state.kind === "ok") return `OK · ${formatVoiceCount(state.voices)}`;
  return `err: ${state.reason.slice(0, 16)}`;
};
