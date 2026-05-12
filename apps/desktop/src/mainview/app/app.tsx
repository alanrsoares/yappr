import { RouterProvider } from "@tanstack/react-router";

import { VoiceStoreProvider } from "~/screens/voice";
import { router } from "./router";

function App() {
  return (
    <VoiceStoreProvider>
      <RouterProvider router={router} />
    </VoiceStoreProvider>
  );
}

export default App;
