"""Kokoro 82M TTS adapter.

Wraps :mod:`kokoro.KPipeline` behind :class:`ports.TtsEngine`. The
:data:`KOKORO_VOICES` catalog is the runtime authority for which voice ids
the daemon advertises via ``GET /voices``; apps query the daemon at boot
instead of duplicating the list client-side.
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]

from ports import Audio, TtsEngine, Voice
from result import Err, Ok, Result

KOKORO_VOICES: list[str] = [
    "af_alloy",
    "af_aoede",
    "af_bella",
    "af_heart",
    "af_jessica",
    "af_kore",
    "af_nicole",
    "af_nova",
    "af_river",
    "af_sarah",
    "af_sky",
    "am_adam",
    "am_echo",
    "am_eric",
    "am_fenrir",
    "am_liam",
    "am_michael",
    "am_onyx",
    "am_puck",
    "am_santa",
]

_SAMPLE_RATE = 24_000
_DEFAULT_VOICE = "af_aoede"


class KokoroEngine(TtsEngine):
    """Adapter for the ``hexgrad/Kokoro-82M`` v1.0 release (``lang_code=a``)."""

    name = "kokoro"

    def __init__(self, pipeline: Any) -> None:
        self._pipeline = pipeline

    @classmethod
    def load(cls) -> KokoroEngine:
        import kokoro

        pipeline = kokoro.KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
        return cls(pipeline)

    def voices(self) -> Result[list[Voice], Exception]:
        return Ok([Voice(id=v) for v in KOKORO_VOICES])

    def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> Result[Audio, Exception]:
        try:
            generator = self._pipeline(text, voice=voice or _DEFAULT_VOICE, speed=speed)
            chunks: list[np.ndarray] = [audio for _, _, audio in generator]
            if not chunks:
                return Err(ValueError("No audio generated (empty text?)"))
            buffer = io.BytesIO()
            sf.write(buffer, np.concatenate(chunks), _SAMPLE_RATE, format="WAV")
            buffer.seek(0)
            return Ok(Audio(data=buffer.read(), sample_rate=_SAMPLE_RATE))
        except Exception as exc:  # noqa: BLE001 — boundary, return Result
            return Err(exc)
