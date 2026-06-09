"""Composition root: env-driven adapter wiring.

Reads ``YAPPR_TTS_BACKEND`` (``kokoro``, default and currently only option) and
``YAPPR_STT_BACKEND`` (``whisper``, default and currently only option) and
returns concrete adapters that satisfy the ports in :mod:`ports`. The server
keeps the returned values on ``app.state`` and routes call port methods only.

Returns ``None`` for engines that fail to load — routes degrade to a 503 so a
Kokoro failure doesn't kill STT (or vice versa) on shared instances.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable

    from config import Settings
    from ports import SttEngine, TtsEngine

_log = logging.getLogger(__name__)


def build_tts(settings: Settings) -> TtsEngine | None:
    backend = settings.tts_backend.strip().lower()
    loader = _TTS_LOADERS.get(backend)
    if loader is None:
        _log.error("Unknown YAPPR_TTS_BACKEND=%r; expected %s", backend, "|".join(_TTS_LOADERS))
        return None
    try:
        _log.info("Loading TTS backend %r…", backend)
        engine = loader()
        _log.info("TTS backend %r ready.", backend)
    except Exception:  # noqa: BLE001 — boundary: any load failure degrades to 503
        _log.exception("Failed to load TTS backend %r", backend)
        return None
    return engine


def _load_kokoro() -> TtsEngine:
    from adapters.kokoro_engine import KokoroEngine

    return KokoroEngine.load()


# Backend id → factory. Adding a new TTS engine = one line here + one adapter file.
_TTS_LOADERS: dict[str, Callable[[], TtsEngine]] = {
    "kokoro": _load_kokoro,
}


def build_stt(settings: Settings) -> SttEngine | None:
    backend = settings.stt_backend.strip().lower()
    if backend != "whisper":
        _log.error("Unknown YAPPR_STT_BACKEND=%r; expected whisper", backend)
        return None

    from adapters.whisper_engine import WhisperEngine

    _log.info("Loading Whisper STT (faster-whisper)…")
    engine = WhisperEngine.load(settings)
    if engine is None:
        _log.warning("Whisper failed to load; STT disabled.")
    else:
        _log.info("Whisper ready.")
    return engine
