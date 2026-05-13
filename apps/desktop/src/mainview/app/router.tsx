import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { ChatScreen } from "~/screens/chat";
import { AppLayout } from "../shell/app-layout";

const rootRoute = createRootRoute({
  component: AppLayout,
});

// Chat-first: a single root surface. Voice controls live inside the chat
// through the settings sheet and per-message speak actions.
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ChatScreen,
});

const routeTree = rootRoute.addChildren([chatRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
