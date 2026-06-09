"""Pytest fixtures.

``YAPPR_TEST=1`` short-circuits the server lifespan so no real ML models load.
The ``client`` fixture additionally installs an in-memory fake TTS engine on
``app.state.tts`` so route tests (``/voices``, ``/synthesize``) exercise the
full ports → adapter → response path without weights on disk.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, cast

import numpy as np
import pytest
from fastapi.testclient import TestClient

if TYPE_CHECKING:
    from collections.abc import Generator, Iterator

FloatArray = np.ndarray[Any, np.dtype[np.float32]]

os.environ["YAPPR_TEST"] = "1"


def _sine_chunk(
    sample_rate: int = 24_000, duration_s: float = 0.05, hz: float = 440.0
) -> FloatArray:
    n = max(1, int(sample_rate * duration_s))
    t = np.arange(n, dtype=np.float32) / float(sample_rate)
    return cast("FloatArray", (0.05 * np.sin(2.0 * np.pi * hz * t)).astype(np.float32))


class FakeKokoroPipeline:
    """Mimics ``kokoro.KPipeline.__call__``: a generator of
    ``(graphemes, phonemes, audio_ndarray)`` tuples."""

    def __call__(
        self,
        text: str,
        voice: str = "af_aoede",
        speed: float = 1.0,
    ) -> Generator[tuple[str, str, FloatArray], None, None]:
        _ = (text, voice, speed)
        yield ("x", "y", _sine_chunk())
        yield ("x", "y", _sine_chunk(hz=880.0))


class EmptyChunkPipeline:
    """Yields no audio chunks — engine should return Err."""

    def __call__(
        self,
        text: str,
        voice: str = "af_aoede",
        speed: float = 1.0,
    ) -> Generator[tuple[str, str, FloatArray], None, None]:
        _ = (text, voice, speed)
        yield from ()


class RaisingPipeline:
    def __call__(
        self,
        text: str,
        voice: str = "af_aoede",
        speed: float = 1.0,
    ) -> Any:
        _ = (text, voice, speed)
        raise RuntimeError("boom")


@pytest.fixture
def fake_kokoro_pipeline() -> FakeKokoroPipeline:
    return FakeKokoroPipeline()


@pytest.fixture
def empty_pipeline() -> EmptyChunkPipeline:
    return EmptyChunkPipeline()


@pytest.fixture
def raising_pipeline() -> RaisingPipeline:
    return RaisingPipeline()


@pytest.fixture
def client(fake_kokoro_pipeline: FakeKokoroPipeline) -> Iterator[TestClient]:
    """FastAPI test client with a fake Kokoro engine pre-mounted on app.state."""
    from adapters.kokoro_engine import KokoroEngine
    from server import app

    with TestClient(app) as test_client:
        app.state.tts = KokoroEngine(fake_kokoro_pipeline)
        app.state.stt = None
        yield test_client
