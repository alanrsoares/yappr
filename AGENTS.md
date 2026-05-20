# AGENTS.md

> **Unified context for AI agents**  
> How Yappr is built, where things live, and how to run or change it safely.

## 1. Project overview

**Yappr** is a local-first voice assistant: an **Ink + React TUI** and small **TypeScript SDK** talk to a **Python FastAPI** server for **Kokoro TTS** and **Whisper STT**, while chat uses **Ollama** and/or **OpenRouter** with optional **MCP** tools (config cascade: `$YAPPR_MCP_CONFIG` → `~/.config/yappr/mcp.json` → `~/.cursor/mcp.json`; resolved in `packages/sdk/src/paths.ts`).

The repo is a **Bun workspace monorepo**:

- **`apps/cli/`** — Ink + React TUI and one-shot CLI commands (Bun + TypeScript).
- **`apps/desktop/`** — Electrobun desktop app (React + Tailwind + Vite + shadcn/prompt-kit). Chat-first surface with persistence: sidebar conversation list, streaming Ollama chat, per-message TTS, composer-mic STT, voice/server settings sheet. Mirrors **`apps/cli`** layout: `screens/<name>/screen.tsx`, optional store, `services/yappr/` TTS façade, `hooks/`, shared `types.ts`. Bun-side (`src/bun/`) owns the SQLite handle; webview talks to it through the typed `@yappr/db/rpc` channel.
- **`packages/sdk/`** — TTS/STT clients, MCP manager, MCP path cascade, OpenAPI types. Published as `@yappr/sdk`.
- **`packages/lib/`** — shared utilities (`Result`/`ResultAsync` helpers, unstated container). Published as `@yappr/lib`.
- **`packages/db/`** — `bun:sqlite` + Drizzle persistence (preferences, conversations, messages) and zod-derived RPC schemas. CLI uses the repos directly; desktop calls them over Electrobun RPC. Single DB at `~/.yappr/yappr.db` shared by both surfaces.
- **`python/`** — FastAPI inference server (see `python/README.md`).
- **OpenAPI client types**: `bun run openapi:export` regenerates `packages/sdk/src/schema.d.ts` from the Python app.

## 2. Tech stack

This repo is **Bun-first**: TypeScript runs on **Bun**, not Node, for installs, scripts, tests, and the TUI.

- **Runtime**: **Bun** only for TS execution, installs, and tests — use **`bun`**, **`bun run`**, **`bun test`**, **`bunx`**. Do not add npm/yarn/pnpm workflows or assume a Node-only runtime for project commands.
- **Bun APIs (prefer these)**: **`Bun.file`** / **`Bun.write`** for file I/O, **`Bun.$`** (or **`spawn` from `"bun"`**) for subprocesses, **`bun:sqlite`** / **`Bun.sql`** / **`Bun.redis`** when applicable — see [Bun docs](https://bun.sh/docs). Bun loads `.env` in the project root automatically; **do not add `dotenv`** on the Bun side.
- **Node compatibility**: Use **`node:`** imports (`node:fs`, `node:path`, …) only when there is no good Bun-native substitute (e.g. **`fs.writeSync`** to a TTY fd for terminal modes, **`mkdir`** next to `Bun.write` when the directory must exist first).
- **TUI**: Ink + React (`apps/cli/src/screens/`); screen state often uses `createContainer` from `@yappr/lib/unstated`.
- **Errors**: `neverthrow` (`Result` / `ResultAsync`) for service boundaries where the codebase already uses it.
- **Lint / format**: ESLint + Prettier (`bun run lint`, `bun run format`).
- **Python**: 3.11+, FastAPI, **uv** for env + deps (`uv sync --extra dev`, `uv run …`) in `python/` — `uv.lock` is committed. See that package's README and `pyproject.toml`.

## 3. Repository layout

| Path                         | Role                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/cli/src/`              | Ink app entry (`app.tsx`, `Root.tsx`), screens (`screens/*`), hooks, `services/yappr` (HTTP to Python, chat, speak, STT).                                                                                                                                             |
| `apps/cli/src/screens/`      | One folder per screen (e.g. `chat/`, `settings/`, `voices/`); often `screen.tsx` + `store.tsx` + `components/`.                                                                                                                                                       |
| `apps/desktop/src/bun/`      | Electrobun main process: window config, opens `~/.yappr/yappr.db`, registers `@yappr/db/rpc` handlers.                                                                                                                                                                |
| `apps/desktop/src/mainview/` | Electrobun webview: `app/` (router), `shell/` (chrome), `screens/*` (screen + store like CLI — `chat/` is the current home surface), `services/yappr/`, `ui/` (shadcn + prompt-kit), `lib/` (queries, db-rpc, voice-store, audio, drag-region), `hooks/`, `types.ts`. |
| `packages/sdk/src/`          | TTS/STT clients, MCP manager + path cascade, OpenAPI types (`schema.d.ts`); regen with `openapi:export`.                                                                                                                                                              |
| `packages/lib/src/`          | Shared utilities (`result.ts`, `unstated.tsx`).                                                                                                                                                                                                                       |
| `packages/db/src/`           | Drizzle SQLite schema + repositories (`conversations`, `messages`, `preferences`), legacy `settings.json` importer, and zod RPC contract (`rpc.ts` — drizzle-zod for row schemas, hand-authored zod for inputs).                                                      |
| `python/`                    | FastAPI server, Kokoro/Whisper wiring, pytest suite.                                                                                                                                                                                                                  |
| `openapi.json`               | Exported schema; source of truth is the Python OpenAPI export.                                                                                                                                                                                                        |

**Imports in TS**:

- **Intra-package** (within `apps/cli`, `packages/sdk`, `packages/lib`): use the `~/` alias to that package's `src/` and **`.js` extensions** for ESM (e.g. `import x from "~/store.js"`).
- **Within `apps/desktop/src/mainview`**: use the **`~/`** alias to that folder (configured in `apps/desktop/tsconfig.json` and `vite.config.ts`) — same spirit as the CLI, no `@/` alias in the desktop webview.
- **Cross-package**: use workspace package imports — `@yappr/lib/result`, `@yappr/lib/unstated`, `@yappr/sdk/paths`, `@yappr/sdk/mcp`, `@yappr/db`, `@yappr/db/rpc`, etc. (no `.js` extension; the package `exports` map points at `.ts` source.)
- `apps/desktop` has its own `tsconfig.json` + React/Vite stack but participates in the workspace: it imports `@yappr/sdk` (TTS/STT, schemas) and `@yappr/db` (preferences + chat persistence over Electrobun RPC). Inside `src/mainview/` prefer **`~/…`** imports (not `@/`). The bun-side (`src/bun/`) owns the SQLite handle; the webview only sees it through the typed RPC channel in `lib/db-rpc.ts`.

## 4. Commands

```bash
bun install              # Dependencies
bun run typecheck        # tsc --noEmit
bun run lint             # ESLint
bun run test             # Bun tests (src)
bun run test:py          # pytest in python/
bun run format           # Prettier

bun run serve            # Python inference server (see python/README.md)
bun run tui              # Main Ink TUI (forwards to @yappr/cli). First launch runs the assisted setup wizard (`apps/cli/src/screens/setup/`); main menu shows a ✓ once `preferences.firstRunCompleted` is set.
bun run speak -- "text"  # One-shot TTS
bun run chat -- "query"  # One-shot chat
bun run desktop          # Electrobun desktop with HMR (experimental, @yappr/desktop)
bun run openapi:export   # Regenerate TS types from Python OpenAPI
```

Prefer **`bun run <script>`**, **`bun <file.ts>`**, and **`bunx`** instead of npm/npx.

## 5. Conventions

- **Functions**: Prefer **terse arrow functions** when the whole body is a single expression (use implicit `return`). Use a **named `function`** when you need a block (multiple statements, locals, or branching). Omit **explicit return types** unless the return is not obviously a primitive (or public API stability demands it).
- **Finite branching**: Prefer **`Record<K, () => void>`** (or **`Map`**) for closed sets of modes (e.g. settings picker commit, text-editor confirm/cancel). For prioritized UI states, use an ordered **`{ when, render }[]`** and `.find()` (see `ChatStatus`). Slash commands resolve via token **`Map`**s in `slash-commands.ts`.
- **Screens**: Keep keyboard and side effects in the store or screen-level hooks; reuse `useKeyboard` / `getEffectiveKey` when implementing custom `useInput` flows (slash palette, list filters).
- **Slash commands** (chat): Registered in `apps/cli/src/screens/chat/slash-commands.ts`; context is built in `store.tsx`.
- **Settings / voices**: Prefer the same **store + thin screen** pattern as existing screens.
- **Secrets**: Never commit real API keys or `.env`; OpenRouter and paths live in user preferences / env.

## 6. TUI patterns & styling

- **Semantic colors**: Use `~/theme/semantic.js` (`semantic.accent`, `semantic.error`, `semantic.border.*`, …) instead of scattering `"cyan"` / `"red"` literals. Chat bubbles use `~/theme/chat-appearance.js` (`bubbleBorderForRole`, `streamingBubbleBorder`).
- **Footer hints**: Reuse `~/footer-items.js` — `FOOTER_SPEAK`, `FOOTER_MCP_STATUS`, `FOOTER_SETTINGS_LIST`, `FOOTER_SETTINGS_EDIT`, `footerVoices()`, `buildChatFooterItems()`. Do not duplicate `{ key, label }` rows per screen.
- **Terminal width**: `useTerminalWidth()` from `~/hooks` reads `stdout.columns` for layouts that should match the terminal (e.g. chat root `Box` `width`).
- **Alternate screen / exit cleanup**: On startup, `enterAlternateScreenSync()` (`~/terminal-cleanup.js`) enables the xterm alternate buffer when `stdout` is a TTY and **`YAPPR_ALT_SCREEN`** is not `0`/`false`/`no`/`off` — use that if alternate-buffer breaks your terminal. `process.on("exit")` in `app.tsx` runs `cleanupTerminalModesSync()` (leave alternate screen, then bracketed paste / mouse / SGR reset). **`registerSignalHandlers()`** (`~/shutdown-hooks.js`) stops audio on **SIGINT** (exit 130) / **SIGTERM** (exit 143) before exit so the same cleanup runs. Do not call `cleanupTerminalModesSync` from `quit()` — it only stops playback and exits.
- **Further reading**: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) `packages/cli/src/ui/` — alternate buffer, scroll registry, theme tokens, and terminal capability probing (patterns to borrow gradually, not copy wholesale).

## 7. Git

Use **Conventional Commits** (e.g. `feat(cli): …`, `fix(python): …`, `refactor(cli): …`). Run typecheck and lint for TS changes; run Python tests when touching `python/`.
