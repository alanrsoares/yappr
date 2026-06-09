"""Typed, centralized runtime config.

One ``pydantic-settings`` model replaces scattered ``os.environ.get`` reads across the
composition root and adapters. Fields map to ``YAPPR_*`` env vars via ``env_prefix`` and
parse to their declared types (``bool`` accepts ``1/0/true/false/yes/no/on/off``), so
call sites get validated values instead of raw strings. Construct once at the boundary
(lifespan / adapter ``load``) with :func:`load_settings`; the pure core never reads env.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process configuration sourced from ``YAPPR_*`` env vars (then ``.env``)."""

    model_config = SettingsConfigDict(
        env_prefix="YAPPR_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Test mode: skip loading real ML weights in the server lifespan.
    test: bool = False

    # Backend selection — must match a key in composition._TTS_LOADERS / the STT wiring.
    tts_backend: str = "kokoro"
    stt_backend: str = "whisper"

    # Whisper (faster-whisper) tuning.
    whisper_model: str = "small.en"
    stt_beam_size: int = 1
    stt_vad: bool = True


def load_settings() -> Settings:
    """Read settings from the process environment (then ``.env``).

    Call at the boundary (server lifespan, adapter ``load``) — not at import time —
    so tests that set env vars before startup are honoured.
    """
    return Settings()
