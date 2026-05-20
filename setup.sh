#!/bin/bash

# Yappr Unified Setup Script
set -e

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🎙️ Setting up Yappr..."

# 1. Check for system dependencies
command -v bun >/dev/null 2>&1 || { echo >&2 "❌ Bun is not installed. Visit https://bun.sh"; exit 1; }
command -v uv  >/dev/null 2>&1 || { echo >&2 "❌ uv is not installed. Run: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
command -v brew >/dev/null 2>&1 || { echo >&2 "⚠️ Homebrew not found. Ensure sox, ffmpeg, espeak-ng, and ollama are installed manually."; }

if command -v brew >/dev/null 2>&1; then
    echo "📦 Checking system dependencies (sox, ffmpeg, espeak-ng, ollama)..."
    brew install sox ffmpeg espeak-ng ollama --quiet
fi

# 2. Install JS dependencies
echo "📦 Installing JS dependencies..."
bun install

# 3. Setup Python environment (uv creates python/.venv from uv.lock)
echo "🐍 Setting up Python environment with uv..."
(cd python && uv sync --extra dev)

echo "✅ Setup complete!"
echo "🚀 Run 'bun run serve' in one terminal and 'bun run tui' in another to get started."
echo "    (The TUI runs a first-launch wizard that double-checks the env.)"
