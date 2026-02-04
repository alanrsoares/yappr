# Yappr inference server (Python)

TTS (Kokoro) and STT (Whisper) FastAPI server. Kept to the same standards as the Bun/TS side: **type safety**, **explicit error handling**, **clear separation of side effects**.

## Standards

- **Typing**: Full type hints; `mypy --strict` (see `pyproject.toml`). No untyped defs.
- **Errors**: Use the `Result[T, E]` type (`result.py`), neverthrow-style. Core logic returns `Ok(value)` or `Err(exception)`; HTTP layer maps to status codes.
- **Layering**: `core.py` = pure business logic (Result in, Result out). `server.py` = FastAPI routes only; calls core and translates Result to HTTP.
- **Lint/format**: Ruff (lint + format). Run `ruff check .` and `ruff format .`.
- **Tests**: pytest in `tests/`. Use `YAPPR_TEST=1` so the server does not load Kokoro/Whisper in process.

## Commands

```bash
# From repo root
cd python
python -m venv venv
source venv/bin/activate   # or: venv\Scripts\activate on Windows
pip install -e ".[dev]"    # install with dev deps

ruff check .
ruff format .
mypy server.py core.py result.py
python -m pytest tests/ -v
```

## Run server

```bash
pip install -e .
python server.py
# or: uvicorn server:app --host 0.0.0.0 --port 8000
```
