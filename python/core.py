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


def get_voices() -> Result[list[str], Exception]:
    """Kokoro v1 American English voice IDs (lang_code=a, af_* / am_*)."""
    voices = [
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
    return Ok(voices)


def synthesize(
    pipeline: Any,
    text: str,
    voice: str = "af_bella",
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


def transcribe(audio_path: str) -> Result[str, Exception]:
    model = get_stt_model()
    if model is None:
        return Err(RuntimeError("STT model not loaded"))
    try:
        segments, info = model.transcribe(audio_path, beam_size=5)
        text = " ".join(segment.text for segment in segments).strip()
        return Ok(text)
    except Exception as e:
        return Err(e)


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
            segments, info = model.transcribe(tmp_path, beam_size=5)
            text = " ".join(segment.text for segment in segments).strip()
            return Ok((text, info.language or "", info.language_probability or 0.0))
        finally:
            os.unlink(tmp_path)
    except Exception as e:
        return Err(e)
