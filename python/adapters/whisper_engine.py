"""Whisper STT adapter.

Wraps :mod:`faster_whisper.WhisperModel` behind :class:`ports.SttEngine`.
Defaults match the historical sidecar tuning: ``small.en`` model on CPU
``int8``, VAD filter on, beam size 1.
"""

from __future__ import annotations

import os
import tempfile
from typing import TYPE_CHECKING, Any

from config import load_settings
from ports import SttEngine, Transcription
from result import Err, Ok, Result

if TYPE_CHECKING:
    from config import Settings


class WhisperEngine(SttEngine):
    """Adapter for :mod:`faster_whisper`. CPU ``int8`` by default.

    ``beam_size=1`` is ~2x faster than the historical 5 with negligible quality
    loss; the VAD filter clips silence, killing most of Whisper's "You"
    hallucinations. Both are tunable via ``YAPPR_STT_*`` (see :class:`config.Settings`).
    """

    name = "whisper"

    def __init__(self, model: Any, *, beam_size: int = 1, vad_filter: bool = True) -> None:
        self._model = model
        self._beam_size = beam_size
        self._vad_filter = vad_filter

    @classmethod
    def load(cls, settings: Settings | None = None) -> WhisperEngine | None:
        """Load the configured Whisper model or return ``None`` on failure.

        Returning ``None`` is intentional — the server keeps serving TTS even
        when STT fails, and routes degrade to 503 with a helpful message.
        """
        from faster_whisper import WhisperModel

        cfg = settings or load_settings()
        try:
            model = WhisperModel(cfg.whisper_model, device="cpu", compute_type="int8")
        except Exception:  # noqa: BLE001 — load failure → STT disabled
            return None
        return cls(model, beam_size=cfg.stt_beam_size, vad_filter=cfg.stt_vad)

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
                    beam_size=self._beam_size,
                    vad_filter=self._vad_filter,
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
