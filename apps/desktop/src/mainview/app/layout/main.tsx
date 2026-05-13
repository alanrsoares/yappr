import { Outlet } from "@tanstack/react-router";

import { TooltipProvider } from "~/ui/tooltip";

/**
 * Minimal app shell. Each route paints its own chrome:
 *   - ChatScreen mounts ChatLayout (sidebar + main column).
 * AppLayout only provides global providers that every route needs.
 */
export function MainLayout() {
  return (
    <TooltipProvider delayDuration={250}>
      <Outlet />
    </TooltipProvider>
  );
}
