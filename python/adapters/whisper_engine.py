"""Whisper STT adapter.

Wraps :mod:`faster_whisper.WhisperModel` behind :class:`ports.SttEngine`.
Defaults match the historical sidecar tuning: ``small.en`` model on CPU
``int8``, VAD filter on, beam size 1.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import TYPE_CHECKING, Any

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]

from config import load_settings
from ports import SttEngine, Transcription
from result import Err, Ok, Result

if TYPE_CHECKING:
    from numpy.typing import NDArray

    from config import Settings

_WHISPER_SAMPLE_RATE = 16_000


def _decode_with_soundfile(audio: bytes) -> NDArray[np.float32] | None:
    """Decode PCM/WAV/FLAC/OGG bytes to 16 kHz mono float32 without PyAV."""
    try:
        samples, sr = sf.read(io.BytesIO(audio), dtype="float32", always_2d=False)
    except Exception:  # noqa: BLE001 — fall back to temp-file decoder for non-PCM formats
        return None

    arr = np.asarray(samples, dtype=np.float32)
    if arr.ndim > 1:
        arr = arr.mean(axis=1, dtype=np.float32)
    if sr != _WHISPER_SAMPLE_RATE and arr.size > 0:
        duration = arr.shape[0] / sr
        target_len = max(1, round(duration * _WHISPER_SAMPLE_RATE))
        x_old = np.linspace(0.0, 1.0, num=arr.shape[0], endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
        arr = np.interp(x_new, x_old, arr).astype(np.float32)
    return arr


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

    def _transcribe_source(self, source: Any) -> Result[Transcription, Exception]:
        try:
            segments, info = self._model.transcribe(
                source,
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
        except Exception as exc:  # noqa: BLE001 — boundary
            return Err(exc)

    async def transcribe(
        self,
        audio: bytes,
        *,
        filename: str | None = None,
    ) -> Result[Transcription, Exception]:
        decoded = _decode_with_soundfile(audio)
        if decoded is not None:
            return self._transcribe_source(decoded)

        suffix = os.path.splitext(filename or "")[1] or ".wav"
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio)
                tmp_path = tmp.name
            try:
                return self._transcribe_source(tmp_path)
            finally:
                os.unlink(tmp_path)
        except Exception as exc:  # noqa: BLE001 — boundary
            return Err(exc)
