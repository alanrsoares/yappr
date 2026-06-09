"""API route tests. /voices does not require loaded models."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi.testclient import TestClient


def test_voices_returns_list(client: TestClient) -> None:
    """GET /voices returns JSON with voices array."""
    response = client.get("/voices")
    assert response.status_code == 200
    data = response.json()
    assert "voices" in data
    voices = data["voices"]
    assert isinstance(voices, list)
    assert "af_aoede" in voices
    assert "af_heart" in voices
    assert len(voices) == 20


def test_voices_structure(client: TestClient) -> None:
    """Voices are strings."""
    response = client.get("/voices")
    assert response.status_code == 200
    for v in response.json()["voices"]:
        assert isinstance(v, str)
