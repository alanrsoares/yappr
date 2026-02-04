# Yappr

A simple Bun + TypeScript based Text-to-Speech (TTS) CLI and SDK, powered by the **Kitten TTS model** and integrated with **Ollama** for AI chat.

## Ideation & Architecture

### 1. Core Components

*   **SDK (`src/sdk`)**: A TypeScript library that provides a clean API to interact with the Kitten TTS engine.
    *   `synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer>`
    *   `listVoices()` (if supported)
*   **CLI (`src/cli`)**: A command-line tool using the SDK.
    *   `yappr speak "Hello world"`
    *   `yappr chat --model gemma3 "Tell me a story"` (Streams Ollama text -> TTS)

### 2. Technology Stack

*   **Runtime**: Bun (fast startup, built-in TS support).
*   **Language**: TypeScript.
*   **LLM Provider**: Ollama (local models like `gemma3`, `mistral`).
*   **TTS Engine**: Kitten TTS.

### 3. Open Questions / Next Steps

To proceed with the implementation, we need to define how **Kitten TTS** is executed. Since Kitten TTS is typically a Python/C++ model, we have a few options:

*   **Option A (Python API)**: We run a small Python server (e.g., FastAPI) that loads the Kitten model, and our TS SDK calls it via HTTP.
*   **Option B (Local Command)**: The SDK spawns a process (e.g., `kitten-tts-cli "text" -o output.wav`) if a binary exists.
*   **Option C (Ollama Native?)**: If you have a custom Ollama build that supports TTS directly, we can use the Ollama API.

**Current Assumption**: We will proceed with **Option A** (Python Wrapper) or **Option B** (if you have the binary) as the most robust way to bridge Bun and the model.

## Usage

```bash
# Install dependencies
bun install

# Run CLI (dev)
bun run src/cli/index.ts speak "Hello there!"
```