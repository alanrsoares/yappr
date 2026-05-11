"""TTS smoke tests: fake Kokoro-shaped pipeline, no weights loaded (YAPPR_TEST=1)."""

from __future__ import annotations

import io
from collections.abc import Generator
from typing import Any
from unittest.mock import patch

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

import core


def _sine_chunk(
    sample_rate: int = 24_000, duration_s: float = 0.05, hz: float = 440.0
) -> np.ndarray:
    n = max(1, int(sample_rate * duration_s))
    t = np.arange(n, dtype=np.float32) / float(sample_rate)
    return (0.05 * np.sin(2.0 * np.pi * hz * t)).astype(np.float32)


class FakeKokoroPipeline:
    """Mimics ``kokoro.KPipeline.__call__``: generator of (graphemes, phonemes, audio_ndarray)."""

    def __call__(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
    ) -> Generator[tuple[str, str, np.ndarray], None, None]:
        _ = (text, voice, speed)
        yield ("x", "y", _sine_chunk())
        yield ("x", "y", _sine_chunk(hz=880.0))


class EmptyChunkPipeline:
    """Yields no audio chunks (core should return Err for empty concatenation)."""

    def __call__(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
    ) -> Generator[tuple[str, str, np.ndarray], None, None]:
        _, _, _ = text, voice, speed
        yield from ()


class RaisingPipeline:
    def __call__(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
    ) -> Any:
        _, _, _ = text, voice, speed
        raise RuntimeError("boom")


def test_synthesize_ok_returns_wav_bytes() -> None:
    result = core.synthesize(FakeKokoroPipeline(), "hello", voice="af_bella", speed=1.0)
    assert result.is_ok()
    wav = result.value
    assert isinstance(wav, bytes)
    assert wav[:4] == b"RIFF"
    buf = io.BytesIO(wav)
    audio, sr = sf.read(buf)
    assert sr == 24_000
    assert audio.shape[0] > 0


def test_synthesize_empty_chunks_is_err() -> None:
    result = core.synthesize(EmptyChunkPipeline(), "hello")
    assert result.is_err()
    assert "No audio generated" in str(result.error)


def test_synthesize_pipeline_exception_is_err() -> None:
    result = core.synthesize(RaisingPipeline(), "hello")
    assert result.is_err()
    assert "boom" in str(result.error)


def test_post_synthesize_route_smoke(client: TestClient) -> None:
    """Full HTTP path with patched pipeline; still no Kokoro load."""
    fake = FakeKokoroPipeline()
    with patch("server.get_pipeline", return_value=fake):
        response = client.post(
            "/synthesize",
            json={"text": "smoke", "voice": "af_bella", "speed": 1.0},
        )
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("audio/wav")
    body = response.content
    assert body[:4] == b"RIFF"
    audio, sr = sf.read(io.BytesIO(body))
    assert sr == 24_000
    assert audio.shape[0] > 0


def test_post_synthesize_route_503_when_pipeline_unloaded(client: TestClient) -> None:
    with patch("server.get_pipeline", return_value=None):
        response = client.post("/synthesize", json={"text": "x"})
    assert response.status_code == 503
