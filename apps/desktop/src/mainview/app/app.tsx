import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { VoiceStoreProvider } from "~/lib/voice-store";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VoiceStoreProvider>
        <RouterProvider router={router} />
      </VoiceStoreProvider>
    </QueryClientProvider>
  );
}

export default App;
