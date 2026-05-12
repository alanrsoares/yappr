import { Outlet } from "@tanstack/react-router";

import { TooltipProvider } from "~/ui/tooltip";

/**
 * Minimal app shell. Each route paints its own chrome:
 *   - ChatScreen mounts ChatLayout (sidebar + main column, standard chat UX).
 *   - VoiceScreen wraps itself in DeckChrome (cassette chassis + SerialPlate).
 * AppLayout only provides global providers that every route needs.
 */
export function AppLayout() {
  return (
    <TooltipProvider delayDuration={250}>
      <Outlet />
    </TooltipProvider>
  );
}
