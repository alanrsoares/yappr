#!/bin/bash

# Yappr Unified Setup Script
set -e

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🎙️ Setting up Yappr..."

# 1. Check for system dependencies
command -v bun >/dev/null 2>&1 || { echo >&2 "❌ Bun is not installed. Visit https://bun.sh"; exit 1; }
python3 -c 'import sys; exit(0 if sys.version_info >= (3, 11) else 1)' || { echo >&2 "❌ Python 3.11+ is required."; exit 1; }
command -v brew >/dev/null 2>&1 || { echo >&2 "⚠️ Homebrew not found. Ensure sox, ffmpeg, and ollama are installed manually."; }

if command -v brew >/dev/null 2>&1; then
    echo "📦 Checking system dependencies (sox, ffmpeg, ollama)..."
    brew install sox ffmpeg ollama --quiet
fi

# 2. Install JS dependencies
echo "📦 Installing JS dependencies..."
bun install

# 3. Setup Python environment
echo "🐍 Setting up Python environment..."
cd python
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -e ".[dev]"
cd ..

echo "✅ Setup complete!"
echo "🚀 Run 'bun run serve' in one terminal and 'bun run tui' in another to get started."
