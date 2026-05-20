"""TTS/STT helpers; Result types only."""

from __future__ import annotations

import io
import os
import tempfile
from typing import Any

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]

from result import Err, Ok, Result

_stt_model: Any = None


def set_stt_model(model: Any) -> None:
    global _stt_model
    _stt_model = model


def get_stt_model() -> Any:
    return _stt_model


"""Kokoro v1 American English voice IDs (lang_code=a, af_* / am_*).

Source of truth lives in ``@yappr/sdk/kokoro-voices`` (``KOKORO_VOICES``).
Apps prefer the static SDK list at boot to avoid an HTTP round-trip;
this list is what the running daemon advertises today and must stay in
sync. The parity test in ``python/tests/test_voices_parity.py`` will
fail if these two lists drift.
"""
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


def get_voices() -> Result[list[str], Exception]:
    """Return the daemon's advertised Kokoro voice IDs."""
    return Ok(KOKORO_VOICES)


def synthesize(
    pipeline: Any,
    text: str,
    voice: str = "af_aoede",
    speed: float = 1.0,
    sample_rate: int = 24000,
) -> Result[bytes, Exception]:
    try:
        generator = pipeline(text, voice=voice, speed=speed)
        all_audio: list[np.ndarray] = []
        for _, _, audio in generator:
            all_audio.append(audio)
        if not all_audio:
            return Err(ValueError("No audio generated (empty text?)"))
        full_audio = np.concatenate(all_audio)
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, sample_rate, format="WAV")
        buffer.seek(0)
        return Ok(buffer.read())
    except Exception as e:
        return Err(e)


# beam_size=1 is ~2x faster than the historical 5 with negligible quality loss.
_STT_BEAM_SIZE = int(os.environ.get("YAPPR_STT_BEAM_SIZE", "1"))

# VAD filter clips silence — kills most of Whisper's "You" hallucinations.
_STT_VAD_FILTER = os.environ.get("YAPPR_STT_VAD", "1") not in ("0", "false", "no", "off")


async def transcribe_upload(
    file_content: bytes,
    filename: str | None = None,
) -> Result[tuple[str, str, float], Exception]:
    model = get_stt_model()
    if model is None:
        return Err(RuntimeError("STT model not loaded"))
    suffix = os.path.splitext(filename or "")[1] or ".wav"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        try:
            segments, info = model.transcribe(
                tmp_path,
                beam_size=_STT_BEAM_SIZE,
                vad_filter=_STT_VAD_FILTER,
            )
            text = " ".join(segment.text for segment in segments).strip()
            return Ok((text, info.language or "", info.language_probability or 0.0))
        finally:
            os.unlink(tmp_path)
    except Exception as e:
        return Err(e)
