# AGENTS.md

> **Unified context for AI agents**  
> How Yappr is built, where things live, and how to run or change it safely.

## 1. Project overview

**Yappr** is a local-first voice assistant: an **Ink + React TUI** and small **TypeScript SDK** talk to a **Python FastAPI** server for **Kokoro TTS** and **Whisper STT**, while chat uses **Ollama** and/or **OpenRouter** with optional **MCP** tools (config from `~/.cursor/mcp.json`).

- **CLI / orchestration**: Bun + TypeScript under `src/cli/`.
- **Inference**: Python under `python/` (see `python/README.md`).
- **OpenAPI client types**: `bun run openapi:export` regenerates `src/sdk/schema.d.ts` from the Python app.

## 2. Tech stack

This repo is **Bun-first**: TypeScript runs on **Bun**, not Node, for installs, scripts, tests, and the TUI.

- **Runtime**: **Bun** only for TS execution, installs, and tests — use **`bun`**, **`bun run`**, **`bun test`**, **`bunx`**. Do not add npm/yarn/pnpm workflows or assume a Node-only runtime for project commands.
- **Bun APIs (prefer these)**: **`Bun.file`** / **`Bun.write`** for file I/O, **`Bun.$`** (or **`spawn` from `"bun"`**) for subprocesses, **`bun:sqlite`** / **`Bun.sql`** / **`Bun.redis`** when applicable — see [Bun docs](https://bun.sh/docs). Bun loads `.env` in the project root automatically; **do not add `dotenv`** on the Bun side.
- **Node compatibility**: Use **`node:`** imports (`node:fs`, `node:path`, …) only when there is no good Bun-native substitute (e.g. **`fs.writeSync`** to a TTY fd for terminal modes, **`mkdir`** next to `Bun.write` when the directory must exist first).
- **TUI**: Ink + React (`src/cli/` screens); screen state often uses `createContainer` from `~/lib/unstated.js`.
- **Errors**: `neverthrow` (`Result` / `ResultAsync`) for service boundaries where the codebase already uses it.
- **Lint / format**: ESLint + Prettier (`bun run lint`, `bun run format`).
- **Python**: 3.11+, FastAPI, uv/pytest in `python/` (see that package’s README and `pyproject.toml`).

## 3. Repository layout

| Path               | Role                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/`         | Ink app entry (`app.tsx`, `Root.tsx`), screens (`screens/*`), hooks, `services/yappr` (HTTP to Python, chat, speak, STT). |
| `src/cli/screens/` | One folder per screen (e.g. `chat/`, `settings/`, `voices/`); often `screen.tsx` + `store.tsx` + `components/`.           |
| `src/sdk/`         | Generated OpenAPI types and MCP helper (`mcp.ts`); regen with `openapi:export`.                                           |
| `python/`          | FastAPI server, Kokoro/Whisper wiring, pytest suite.                                                                      |
| `openapi.json`     | Exported schema; source of truth is the Python OpenAPI export.                                                            |

**Imports in TS**: use the `~/` alias to `src/` and **`.js` extensions** in import specifiers for ESM (e.g. `import x from "./store.js"`).

## 4. Commands

```bash
bun install              # Dependencies
bun run typecheck        # tsc --noEmit
bun run lint             # ESLint
bun run test             # Bun tests (src)
bun run test:py          # pytest in python/
bun run format           # Prettier

bun run serve            # Python inference server (see python/README.md)
bun run tui              # Main Ink TUI (recommended)
bun run speak -- "text"  # One-shot TTS
bun run chat -- "query"  # One-shot chat
bun run openapi:export   # Regenerate TS types from Python OpenAPI
```

Prefer **`bun run <script>`**, **`bun <file.ts>`**, and **`bunx`** instead of npm/npx.

## 5. Conventions

- **Functions**: Prefer **terse arrow functions** when the whole body is a single expression (use implicit `return`). Use a **named `function`** when you need a block (multiple statements, locals, or branching). Omit **explicit return types** unless the return is not obviously a primitive (or public API stability demands it).
- **Finite branching**: Prefer **`Record<K, () => void>`** (or **`Map`**) for closed sets of modes (e.g. settings picker commit, text-editor confirm/cancel). For prioritized UI states, use an ordered **`{ when, render }[]`** and `.find()` (see `ChatStatus`). Slash commands resolve via token **`Map`**s in `slash-commands.ts`.
- **Screens**: Keep keyboard and side effects in the store or screen-level hooks; reuse `useKeyboard` / `getEffectiveKey` when implementing custom `useInput` flows (slash palette, list filters).
- **Slash commands** (chat): Registered in `src/cli/screens/chat/slash-commands.ts`; context is built in `store.tsx`.
- **Settings / voices**: Prefer the same **store + thin screen** pattern as existing screens.
- **Secrets**: Never commit real API keys or `.env`; OpenRouter and paths live in user preferences / env.

## 6. TUI patterns & styling

- **Semantic colors**: Use `~/cli/theme/semantic.js` (`semantic.accent`, `semantic.error`, `semantic.border.*`, …) instead of scattering `"cyan"` / `"red"` literals. Chat bubbles use `~/cli/theme/chat-appearance.js` (`bubbleBorderForRole`, `streamingBubbleBorder`).
- **Footer hints**: Reuse `~/cli/footer-items.js` — `FOOTER_SPEAK`, `FOOTER_MCP_STATUS`, `FOOTER_SETTINGS_LIST`, `FOOTER_SETTINGS_EDIT`, `footerVoices()`, `buildChatFooterItems()`. Do not duplicate `{ key, label }` rows per screen.
- **Terminal width**: `useTerminalWidth()` from `~/cli/hooks` reads `stdout.columns` for layouts that should match the terminal (e.g. chat root `Box` `width`).
- **Alternate screen / exit cleanup**: On startup, `enterAlternateScreenSync()` (`~/cli/terminal-cleanup.js`) enables the xterm alternate buffer when `stdout` is a TTY and **`YAPPR_ALT_SCREEN`** is not `0`/`false`/`no`/`off` — use that if alternate-buffer breaks your terminal. `process.on("exit")` in `app.tsx` runs `cleanupTerminalModesSync()` (leave alternate screen, then bracketed paste / mouse / SGR reset). **`registerSignalHandlers()`** (`~/cli/shutdown-hooks.js`) stops audio on **SIGINT** (exit 130) / **SIGTERM** (exit 143) before exit so the same cleanup runs. Do not call `cleanupTerminalModesSync` from `quit()` — it only stops playback and exits.
- **Further reading**: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) `packages/cli/src/ui/` — alternate buffer, scroll registry, theme tokens, and terminal capability probing (patterns to borrow gradually, not copy wholesale).

## 7. Git

Use **Conventional Commits** (e.g. `feat(cli): …`, `fix(python): …`, `refactor(cli): …`). Run typecheck and lint for TS changes; run Python tests when touching `python/`.
