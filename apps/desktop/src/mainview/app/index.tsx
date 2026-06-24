import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "~/lib/query-client";
import { VoiceProvider } from "~/stores/voice";
import { router } from "./router";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <VoiceProvider>
      <RouterProvider router={router} />
    </VoiceProvider>
  </QueryClientProvider>
);

export default App;
