import { Outlet } from "@tanstack/react-router";

import { Brand, Chassis, NoDrag, SerialNumber, SerialPlate } from "~/deck";
import { useVoiceStore } from "~/screens/voice";
import { PowerCluster } from "~/shell/components/app-status";
import { AppNav } from "./app-nav";

/**
 * Top-level shell. When the route surface grows past ~3 screens, lift
 * `<AppNav />` out of `SerialPlate` into a dedicated left rail (sibling of
 * `<Outlet />`). `AppNav` is already position-agnostic — only this file
 * changes. SerialPlate stays as: brand · serial · indicators.
 */
export function AppLayout() {
  const { health, tts } = useVoiceStore();

  return (
    <Chassis>
      <div className="@container/shell mx-auto w-full max-w-6xl">
        <SerialPlate>
          <div className="flex min-w-0 flex-1 items-baseline gap-2 @md/shell:gap-3">
            <Brand translate="no">Yappr</Brand>
            <SerialNumber translate="no">Y-1 · S/N 001</SerialNumber>
          </div>
          <NoDrag className="flex w-full min-w-0 flex-col items-stretch gap-3 @lg/shell:flex-row @lg/shell:items-center @lg/shell:justify-end @lg/shell:gap-6">
            <AppNav />
            <PowerCluster health={health} tts={tts} />
          </NoDrag>
        </SerialPlate>

        <div className="mt-5 @lg/shell:mt-7">
          <Outlet />
        </div>
      </div>
    </Chassis>
  );
}
