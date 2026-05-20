"""Whisper STT adapter.

Wraps :mod:`faster_whisper.WhisperModel` behind :class:`ports.SttEngine`.
Defaults match the historical sidecar tuning: ``small.en`` model on CPU
``int8``, VAD filter on, beam size 1.
"""

from __future__ import annotations

import os
import tempfile
from typing import Any

from ports import SttEngine, Transcription
from result import Err, Ok, Result

# beam_size=1 is ~2x faster than the historical 5 with negligible quality loss.
_BEAM_SIZE = int(os.environ.get("YAPPR_STT_BEAM_SIZE", "1"))

# VAD filter clips silence — kills most of Whisper's "You" hallucinations.
_VAD_FILTER = os.environ.get("YAPPR_STT_VAD", "1") not in ("0", "false", "no", "off")


class WhisperEngine(SttEngine):
    """Adapter for :mod:`faster_whisper`. CPU ``int8`` by default."""

    name = "whisper"

    def __init__(self, model: Any) -> None:
        self._model = model

    @classmethod
    def load(cls, model_size: str | None = None) -> WhisperEngine | None:
        """Load the configured Whisper model or return ``None`` on failure.

        Returning ``None`` is intentional — the server keeps serving TTS even
        when STT fails, and routes degrade to 503 with a helpful message.
        """
        from faster_whisper import WhisperModel

        size = model_size or os.environ.get("YAPPR_WHISPER_MODEL", "small.en")
        try:
            return cls(WhisperModel(size, device="cpu", compute_type="int8"))
        except Exception:  # noqa: BLE001 — load failure → STT disabled
            return None

    async def transcribe(
        self,
        audio: bytes,
        *,
        filename: str | None = None,
    ) -> Result[Transcription, Exception]:
        suffix = os.path.splitext(filename or "")[1] or ".wav"
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio)
                tmp_path = tmp.name
            try:
                segments, info = self._model.transcribe(
                    tmp_path,
                    beam_size=_BEAM_SIZE,
                    vad_filter=_VAD_FILTER,
                )
                text = " ".join(segment.text for segment in segments).strip()
                return Ok(
                    Transcription(
                        text=text,
                        language=info.language or "",
                        confidence=info.language_probability or 0.0,
                    )
                )
            finally:
                os.unlink(tmp_path)
        except Exception as exc:  # noqa: BLE001 — boundary
            return Err(exc)
