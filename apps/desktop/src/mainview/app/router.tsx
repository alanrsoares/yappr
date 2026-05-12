import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { ChatScreen } from "~/screens/chat";
import { VoiceScreen } from "~/screens/voice";
import { AppLayout } from "../shell/app-layout";

const rootRoute = createRootRoute({
  component: AppLayout,
});

// Chat-first: the root route IS the chat surface. The cassette voice screen
// stays reachable at `/voice` for now while the voice features migrate into
// composer affordances; this route will be retired once the migration lands.
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ChatScreen,
});

const voiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/voice",
  component: VoiceScreen,
});

const routeTree = rootRoute.addChildren([chatRoute, voiceRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
