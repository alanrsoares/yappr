# Yappr inference server (Python)

TTS (**Kokoro** [`hexgrad/Kokoro-82M`](https://huggingface.co/hexgrad/Kokoro-82M) v1 weights via latest `kokoro` on PyPI, currently `>=0.9.4`) and STT (Whisper) FastAPI server. Kept to the same standards as the Bun/TS side: **type safety**, **explicit error handling**, **clear separation of side effects**.

## Standards

- **Typing**: Full type hints; `mypy --strict` (see `pyproject.toml`). No untyped defs.
- **Errors**: Use the `Result[T, E]` type (`result.py`), neverthrow-style. Core logic returns `Ok(value)` or `Err(exception)`; HTTP layer maps to status codes.
- **Layering**: `core.py` = pure business logic (Result in, Result out). `server.py` = FastAPI routes only; calls core and translates Result to HTTP.
- **Lint/format**: Ruff (lint + format). Run `ruff check .` and `ruff format .`.
- **Tests**: pytest in `tests/`. Use `YAPPR_TEST=1` so the server does not load Kokoro/Whisper in process.

## Commands

Uses [uv](https://docs.astral.sh/uv/) for env + deps. `uv.lock` is committed for reproducible installs.

```bash
# From repo root
cd python
uv sync --extra dev          # creates .venv, installs deps from uv.lock

uv run ruff check .
uv run ruff format .
uv run mypy server.py core.py result.py
uv run pytest tests/ -v
```

No manual `activate` step — `uv run` resolves the project venv automatically. If you prefer an activated shell: `source .venv/bin/activate`.

## Run server

```bash
uv run python server.py
# loopback only; for LAN: uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

## Models and cache

On first launch the server downloads two model bundles into the Hugging Face cache (default `~/.cache/huggingface/hub`, overridable with `$HF_HOME`):

| Model        | Default          | Size   | Override                       |
| ------------ | ---------------- | ------ | ------------------------------ |
| Kokoro TTS   | `hexgrad/Kokoro-82M` v1 | ~330MB | (pinned in `server.py`)        |
| Whisper STT  | `small.en`       | ~480MB | `$YAPPR_WHISPER_MODEL` (e.g. `base.en`, `medium.en`, `distil-small.en`) |

`small.en` is the default because `base.en` hallucinates "You" / "Thank you" on short or quiet clips. Set `YAPPR_WHISPER_MODEL=base.en` to revert if disk space or RAM is tight.
