# Contributing to Yappr 🎙️

First off, thank you for considering contributing to Yappr! It's people like you who make Yappr such a great tool.

## 🏗️ Development Setup

Yappr is a hybrid project (Bun/TypeScript + Python).

### Prerequisites

- [Bun](https://bun.sh/)
- [Python 3.11+](https://www.python.org/)
- `sox`, `ffmpeg`, `ollama` (available via Homebrew)

### 1. TypeScript Setup

```bash
bun install
```

### 2. Python Setup

```bash
cd python
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

## 🧪 Running Tests & Quality Checks

Before submitting a PR, please ensure all checks pass.

### TypeScript

```bash
bun run check           # Format check, lint, typecheck, and Bun tests
bun run deadcode        # Advisory Knip scan for unused files/deps/exports
bun run deadcode:strict # Same scan, but exits non-zero on findings
```

### Python

```bash
cd python
ruff check .      # Linting
mypy .            # Type checking
YAPPR_TEST=1 python -m pytest tests/ -v
```

## 🚀 Workflow

1. **Fork** the repository.
2. **Create a branch** for your feature or bugfix.
3. **Write tests** for your changes.
4. **Ensure CI passes** locally.
5. **Submit a Pull Request** with a clear description of your changes.

## 📜 Code of Conduct

Please be respectful and professional in all interactions within this project.

## ⚖️ License

By contributing, you agree that your contributions will be licensed under its MIT License.
