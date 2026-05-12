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

const voiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: VoiceScreen,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatScreen,
});

const routeTree = rootRoute.addChildren([voiceRoute, chatRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
