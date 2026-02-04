"""API route tests. /voices does not require loaded models."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_voices_returns_list(client: TestClient) -> None:
    """GET /voices returns JSON with voices array."""
    response = client.get("/voices")
    assert response.status_code == 200
    data = response.json()
    assert "voices" in data
    voices = data["voices"]
    assert isinstance(voices, list)
    assert "af_bella" in voices


def test_voices_structure(client: TestClient) -> None:
    """Voices are strings."""
    response = client.get("/voices")
    assert response.status_code == 200
    for v in response.json()["voices"]:
        assert isinstance(v, str)
