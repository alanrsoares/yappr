# Yappr 🎙️🤖

Yappr is a high-performance, **100% local** voice assistant CLI and SDK. It combines state-of-the-art TTS/STT models with local LLMs (via Ollama) and extensible tools (via MCP).

Designed to run efficiently on Apple Silicon (M-series), Yappr ensures your voice data and conversations never leave your hardware.

## ✨ Features

- **Kokoro TTS:** Near human-level text-to-speech using the 82M parameter Kokoro model.
- **Whisper STT:** Fast, accurate local speech-to-text via `faster-whisper`.
- **Ollama Integration:** Seamlessly chat with local LLMs like `qwen2.5`, `mistral`, or `llama3`.
- **MCP (Model Context Protocol):** Automatically loads tools from your `~/.cursor/mcp.json`. Your voice assistant can search files, check GitHub, use Figma, and more.
- **Voice Mode:** Real-time voice-to-voice conversation loop.

## 🏗️ Architecture

Yappr uses a hybrid architecture for maximum performance:
- **CLI/SDK (Bun + TypeScript):** Handles orchestration, MCP tool execution, and the user interface.
- **Inference Server (Python + FastAPI):** Wraps the heavy-lifting ML models (Kokoro & Whisper) for high-speed local inference.

## 🚀 Getting Started

### Prerequisites

- **Bun:** `curl -fsSL https://bun.sh/install | bash`
- **Python 3.10+**
- **System Dependencies:**
  ```bash
  brew install sox ffmpeg ollama
  ```

### Installation

1. **Clone and Install JS Dependencies:**
   ```bash
   bun install
   ```

2. **Setup Python Environment:**
   ```bash
   python3 -m venv python/venv
   source python/venv/bin/activate
   pip install -r python/requirements.txt
   ```

## 📖 Usage

### 1. Start the Inference Server
The server must be running in a separate terminal to handle TTS and STT requests.
```bash
bun run serve
```
*(On first run, it will download the Kokoro and Whisper models ~400MB total).*

### 2. Voice-to-Voice Mode (Recommended)
Start an interactive voice session. It will list your microphones; select one and start yapping!
```bash
bun run listen
```

### 3. Text Chat with Voice Output
Chat with Ollama via text and hear the response synthesized.
```bash
bun run chat "What is the capital of France?" --model qwen2.5:14b
```

### 4. Simple Text-to-Speech
```bash
bun run speak "Hello, I am speaking from your terminal." --voice af_sky --speed 1.1
```

### 5. List Available Voices
```bash
bun run voices
```

## 🛠️ Configuration

Yappr automatically detects MCP servers from `~/.cursor/mcp.json`. When using a model that supports tool-calling (like `qwen2.5`), you can ask Yappr to perform actions using those tools.

## 🔒 Privacy

All processing is local.
- **No** cloud APIs.
- **No** data collection.
- **No** subscription fees.
- Just you and your silicon.

## 📜 License

MIT
