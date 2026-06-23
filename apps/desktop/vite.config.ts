import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/mainview",
  resolve: {
    alias: [
      { find: "~", replacement: path.resolve(__dirname, "./src/mainview") },
      // `@tanstack/ai-ollama` imports the node entry of `ollama` (pulls
      // `node:fs`); the webview runs `chat()` in-process, so resolve to the
      // browser build, which exposes the same `Ollama` class over fetch.
      { find: /^ollama$/, replacement: "ollama/browser" },
    ],
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Dev-only: browser → Vite → Ollama (avoids CORS). Production uses direct URL + OLLAMA_ORIGINS.
      "/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ""),
      },
    },
  },
});
