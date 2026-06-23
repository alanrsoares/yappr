import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "~/lib/query-client";
import { useVoiceRuntime } from "~/stores/voice";
import { router } from "./router";

function AppShell() {
  // Mount the voice runtime once, inside the Query provider, so it can drive
  // the voices health query and hydrate the voice store.
  useVoiceRuntime();
  return <RouterProvider router={router} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

export default App;
