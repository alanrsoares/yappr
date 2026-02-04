"""Pytest fixtures. Avoid loading real ML models in tests."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Prevent server startup from loading Kokoro/Whisper when running tests
os.environ["YAPPR_TEST"] = "1"


@pytest.fixture
def client() -> TestClient:
    """FastAPI test client. Uses TestClient so no event loop needed."""
    from server import app
    return TestClient(app)
