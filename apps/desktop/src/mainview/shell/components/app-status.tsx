import type { ComponentProps } from "react";

import { Led } from "~/deck";
import type { HealthState, TtsState } from "~/types";

/**
 * Global shell LEDs. Today the data semantically belongs to the Voice screen
 * (PWR/SYNC reflect inference-server health; REC reflects active playback),
 * but the indicators stay visible across every route so the user always knows
 * the deck's live state. Driven by props — the host (AppLayout) is the one
 * coupling to the voice store, not this presentational component.
 */
export const PowerCluster = ({
  health,
  tts,
}: {
  health: HealthState;
  tts: TtsState;
}) => (
  <div className="flex items-center gap-5">
    <LedRow label="PWR" state={health.kind === "ok" ? "amber" : "amber-soft"} />
    <LedRow
      label="SYNC"
      state={health.kind === "ok" ? "green" : "green-soft"}
    />
    <LedRow label="REC" state={tts.kind === "speaking" ? "red" : "red-soft"} />
  </div>
);

const LedRow = ({
  label,
  state,
}: {
  label: string;
  state: ComponentProps<typeof Led>["$state"];
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <Led $state={state} aria-hidden="true" />
    <span className="font-label font-light text-[0.55rem] tracking-[0.3em] uppercase text-foil-mute">
      {label}
    </span>
  </div>
);
