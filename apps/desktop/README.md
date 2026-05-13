# @yappr/desktop

Electrobun desktop surface for [Yappr](../../README.md). React + Vite + Tailwind + shadcn/prompt-kit, with the same Ollama chat + Kokoro/Whisper voice loop as the CLI but in a native window.

## Run

From the repo root (recommended — picks up the workspace + the Python server script):

```bash
bun run serve     # in one terminal — starts the Python inference server on :8000
bun run desktop   # in another — opens the desktop app with HMR
```

Or directly inside this package:

```bash
bun run dev:hmr   # Vite on :5173 + Electrobun loading from it
bun run dev       # Electrobun loading bundled assets (no HMR)
bun run start     # build once then run Electrobun against bundled assets
```

### Ollama CORS

Ollama (since 0.1.24) only accepts cross-origin requests from origins
on its allow-list. The packaged build loads from `views://mainview`,
which is not on the default list, so `bun run start` will see
`403 Access-Control-Allow-Origin` on every Ollama call. Fix by
exporting one of these before `ollama serve`:

```bash
export OLLAMA_ORIGINS='views://*'    # narrowest — only Electrobun renderers
# or
export OLLAMA_ORIGINS='*'            # any origin — convenient for local dev
```

`bun run dev:hmr` is unaffected because Vite proxies `/ollama` →
`127.0.0.1:11434` (see `vite.config.ts` and `lib/ollama.ts`).

## How it fits together

- **`src/bun/`** — Electrobun main process. Owns the `~/.yappr/yappr.db` SQLite handle (shared with the CLI) and registers the typed `@yappr/db/rpc` request handlers.
- **`src/mainview/`** — webview (React). Talks to the bun side over the Electrobun socket via `lib/db-rpc.ts`; talks to the Python inference server over HTTP via `services/yappr` (`@yappr/sdk`). All async reads go through `@tanstack/react-query` — see `lib/queries.ts` for the canonical query options.
- **`src/mainview/screens/chat/`** — current home surface. Sidebar lists persisted conversations; chat-panel streams Ollama replies and writes user + assistant turns through the RPC channel; settings sheet edits voice/server URL/speed (persisted to preferences).

## Conventions

- Schema-first: row types come from `@yappr/db` (drizzle → drizzle-zod → `z.infer`); RPC inputs are hand-authored zod schemas that the bun-side handler `.parse()`s before touching SQLite.
- Drag regions use the literal classes from `lib/drag-region.ts` (`DRAG`, `NO_DRAG`) — Electrobun's preload script only recognises those exact class names, not raw `-webkit-app-region` CSS.
- See [AGENTS.md](../../AGENTS.md) for the project-wide conventions.
