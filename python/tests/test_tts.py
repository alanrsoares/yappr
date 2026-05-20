"""TTS adapter + route tests.

Adapter-level tests construct ``KokoroEngine`` with a fake pipeline (no
weights). Route tests use the ``client`` fixture which mounts the fake on
``app.state.tts`` so HTTP responses exercise the real port → adapter path.
"""

from __future__ import annotations

import io
from typing import cast

import soundfile as sf  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from adapters.kokoro_engine import KokoroEngine
from ports import Audio
from server import app
from tests.conftest import (
    EmptyChunkPipeline,
    FakeKokoroPipeline,
    RaisingPipeline,
)


def test_engine_synthesize_returns_wav_bytes() -> None:
    engine = KokoroEngine(FakeKokoroPipeline())
    result = engine.synthesize("hello", voice="af_aoede", speed=1.0)
    assert result.is_ok()
    audio = cast(Audio, result.value)
    assert isinstance(audio, Audio)
    assert audio.sample_rate == 24_000
    assert audio.media_type == "audio/wav"
    assert audio.data[:4] == b"RIFF"
    decoded, sr = sf.read(io.BytesIO(audio.data))
    assert sr == 24_000
    assert decoded.shape[0] > 0


def test_engine_synthesize_empty_chunks_is_err() -> None:
    engine = KokoroEngine(EmptyChunkPipeline())
    result = engine.synthesize("hello")
    assert result.is_err()
    assert "No audio generated" in str(result.error)


def test_engine_synthesize_pipeline_exception_is_err() -> None:
    engine = KokoroEngine(RaisingPipeline())
    result = engine.synthesize("hello")
    assert result.is_err()
    assert "boom" in str(result.error)


def test_post_synthesize_route_smoke(client: TestClient) -> None:
    """Full HTTP path — fixture mounts a fake KokoroEngine on app.state.tts."""
    response = client.post(
        "/synthesize",
        json={"text": "smoke", "voice": "af_aoede", "speed": 1.0},
    )
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("audio/wav")
    body = response.content
    assert body[:4] == b"RIFF"
    decoded, sr = sf.read(io.BytesIO(body))
    assert sr == 24_000
    assert decoded.shape[0] > 0


def test_post_synthesize_route_503_when_engine_unloaded(
    client: TestClient,
) -> None:
    app.state.tts = None
    response = client.post("/synthesize", json={"text": "x"})
    assert response.status_code == 503


def test_post_synthesize_route_500_hides_pipeline_exception_message(
    client: TestClient,
) -> None:
    """HTTP clients must not see raw exception strings (may contain local paths)."""
    app.state.tts = KokoroEngine(RaisingPipeline())
    response = client.post(
        "/synthesize",
        json={"text": "x", "voice": "af_aoede", "speed": 1.0},
    )
    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Internal server error"
    assert "boom" not in str(body)


def test_post_transcribe_503_when_stt_unavailable(client: TestClient) -> None:
    """YAPPR_TEST mode + no fake STT — route must return 503 with safe message."""
    response = client.post(
        "/transcribe",
        files={"file": ("x.wav", b"\x00\x00", "audio/wav")},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Speech-to-text is unavailable."
