# Yappr 🎙️🤖

Yappr is a high-performance, **100% local** voice assistant CLI and SDK. It combines state-of-the-art TTS/STT models with local LLMs (via Ollama) and extensible tools (via MCP).

Designed to run efficiently on Apple Silicon (M-series), Yappr ensures your voice data and conversations never leave your hardware.

## ✨ Features

- **Kokoro TTS:** Near human-level text-to-speech using the 82M parameter Kokoro model.
- **Whisper STT:** Fast, accurate local speech-to-text via `faster-whisper`.
- **Ollama Integration:** Seamlessly chat with local LLMs like `qwen2.5`, `mistral`, or `llama3`.
- **MCP (Model Context Protocol):** Auto-discovers tools from `~/.config/yappr/mcp.json` or `~/.cursor/mcp.json` (override with `$YAPPR_MCP_CONFIG` or in Settings). Your voice assistant can search files, check GitHub, use Figma, and more.
- **Voice Mode:** Real-time voice-to-voice conversation loop.

## 🏗️ Architecture

Yappr uses a hybrid architecture for maximum performance:

- **CLI/SDK (Bun + TypeScript):** Handles orchestration, MCP tool execution, and the user interface.
- **Inference Server (Python + FastAPI):** Wraps the heavy-lifting ML models (Kokoro & Whisper) for high-speed local inference.

### Monorepo layout

Bun workspaces:

- `apps/cli/` — Ink + React TUI and one-shot CLI commands.
- `apps/desktop/` — Electrobun desktop app (React + Tailwind + Vite + shadcn/prompt-kit). Chat-first surface with sidebar conversation list, streaming Ollama chat, per-message TTS, composer-mic STT, voice/server settings sheet.
- `packages/sdk/` — `@yappr/sdk` — TTS/STT clients, MCP manager, MCP path cascade, OpenAPI types.
- `packages/lib/` — `@yappr/lib` — shared utilities (`Result`/`ResultAsync`, unstated container).
- `packages/db/` — `@yappr/db` — `bun:sqlite` + Drizzle persistence shared by CLI and desktop (`~/.yappr/yappr.db`); preferences, conversations, messages, and the zod-derived RPC contract.
- `python/` — FastAPI inference server.

## 🚀 Getting Started

### Prerequisites

- **Bun:** `curl -fsSL https://bun.sh/install | bash`
- **Python 3.11+**
- **System Dependencies:**
  ```bash
  brew install sox ffmpeg ollama
  ```

### Installation

```bash
# Clone the repository
git clone https://github.com/alanrsoares/yappr.git
cd yappr

# Run the unified setup script
./setup.sh
```

### Manual Installation (Alternative)

If you prefer to set up components individually:

## 📖 Usage

### 1. Start the Inference Server

The server must be running in a separate terminal to handle TTS and STT requests.

```bash
bun run serve
```

_(On first run, it will download the Kokoro and Whisper models ~400MB total)._

### 2. Interactive TUI (Recommended)

Start the full interactive terminal interface. From here you can access chat, voice mode, settings, and MCP status.

```bash
bun run tui
```

### 3. Quick CLI Commands

Yappr also supports one-shot commands directly from your shell:

#### Text-to-Speech

```bash
bun run speak "Hello, I am speaking from your terminal." --voice af_sky --speed 1.1
```

#### Text Chat

```bash
bun run chat "What is the capital of France?" --model qwen2.5:14b
```

#### List Voices

```bash
bun run voices
```

### 4. Desktop (Experimental)

The desktop app gives you the same Ollama chat + voice loop in a native window — sidebar conversation list, per-message speak, mic-in-composer dictation, and persistent settings shared with the CLI via `~/.yappr/yappr.db`. Start the Python server first (`bun run serve`), then:

```bash
bun run desktop
```

Still ahead: spawning the inference server from inside the app and the packaged-build path-resolution PoC. See `docs/PRODUCT_ROADMAP.md` for status.

## 🛠️ Configuration

Yappr auto-discovers MCP servers via this cascade:

1. `$YAPPR_MCP_CONFIG` env var (explicit override)
2. `~/.config/yappr/mcp.json` (neutral default)
3. `~/.cursor/mcp.json` (Cursor preset — zero-config for Cursor users)

You can also set an explicit path in **Settings → MCP config path**. When using a model that supports tool-calling (like `qwen2.5`), you can ask Yappr to perform actions using those tools.

## 🔒 Privacy

All processing is local.

- **No** cloud APIs.
- **No** data collection.
- **No** subscription fees.
- Just you and your silicon.

## 📜 License

MIT
