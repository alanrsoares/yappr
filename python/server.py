"""FastAPI driver adapter.

Routes are thin: they pull the configured engine from ``app.state``, call a
single port method, and translate the :class:`result.Result` into an HTTP
response. All model/runtime specifics live behind ports in :mod:`adapters`.

Route + schema docstrings below are the **source of truth** for OpenAPI (see
``python/export_openapi.py`` → ``packages/sdk/src/schema.d.ts``).
"""

from __future__ import annotations

import logging
import os
import warnings
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, NoReturn

import uvicorn
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

import composition
from ports import SttEngine, TtsEngine

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

_log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if os.environ.get("YAPPR_TEST"):
        app.state.tts = None
        app.state.stt = None
        yield
        return
    app.state.tts = composition.build_tts()
    app.state.stt = composition.build_stt()
    yield


app = FastAPI(title="Yappr inference sidecar (TTS + STT)", lifespan=lifespan)

# Server binds to 127.0.0.1 only (loopback) — see uvicorn.run at bottom of file.
# Webview clients (Electrobun custom-scheme origin, Vite dev at :5173, TUI fetches)
# are all local processes, so a permissive CORS policy is safe here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _tts(request: Request) -> TtsEngine:
    engine: TtsEngine | None = getattr(request.app.state, "tts", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="TTS not loaded")
    return engine


def _stt(request: Request) -> SttEngine:
    engine: SttEngine | None = getattr(request.app.state, "stt", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="Speech-to-text is unavailable.")
    return engine


class SynthesizeRequest(BaseModel):
    """JSON body for ``POST /synthesize``.

    Produces a WAV-encoded audio stream from the configured TTS engine. Voice
    id and sample rate are engine-specific — see ``GET /voices`` for the
    active catalog. Default voice on Kokoro is ``af_aoede``.
    """

    text: str = Field(..., description="Plain text to speak.")
    voice: str = Field(
        default="af_aoede",
        description=(
            "Engine-specific voice id. Kokoro accepts ``af_*`` / ``am_*`` ids; "
            "Dia accepts its preset names (``default_voice`` today). See ``GET /voices``."
        ),
    )
    speed: float = Field(
        default=1.0,
        description=(
            "Speaking-rate multiplier (1.0 = engine default). Engines without a "
            "speed knob (e.g. Dia) ignore this field silently."
        ),
    )


class HealthResponse(BaseModel):
    """JSON body for ``GET /health``."""

    tts: str = Field(..., description="TTS engine status: ``ready`` or ``unavailable``.")
    stt: str = Field(..., description="STT engine status: ``ready`` or ``unavailable``.")
    tts_backend: str | None = Field(
        default=None,
        description=(
            "Name of the loaded TTS adapter (e.g. ``kokoro``, ``dia``); "
            "``null`` when unavailable."
        ),
    )
    stt_backend: str | None = Field(
        default=None,
        description=(
            "Name of the loaded STT adapter (e.g. ``whisper``); ``null`` when unavailable."
        ),
    )


@app.get("/health", response_model=HealthResponse)
def get_health(request: Request) -> HealthResponse:
    """Report which inference subsystems are ready, and which adapters are bound."""
    tts: TtsEngine | None = getattr(request.app.state, "tts", None)
    stt: SttEngine | None = getattr(request.app.state, "stt", None)
    return HealthResponse(
        tts="ready" if tts is not None else "unavailable",
        stt="ready" if stt is not None else "unavailable",
        tts_backend=tts.name if tts is not None else None,
        stt_backend=stt.name if stt is not None else None,
    )


@app.get("/voices")
def get_voices(request: Request) -> Response:
    """List the voice ids the active TTS engine accepts.

    Shape: ``{"voices": ["<id>", …]}``. Engine-specific — Kokoro returns
    ``af_*`` / ``am_*`` ids; Dia returns its preset names.
    """
    engine = _tts(request)
    result = engine.voices()
    return result.match(
        ok=lambda voices: JSONResponse(content={"voices": [v.id for v in voices]}),
        err=_raise_internal_server_error,
    )


@app.post("/synthesize")
async def synthesize(request: Request, body: SynthesizeRequest) -> Response:
    """Synthesize speech from text using the active TTS engine.

    **Response:** ``audio/wav`` bytes (HTTP 200). Returns 503 when TTS isn't loaded.

    Declared ``async`` even though :meth:`TtsEngine.synthesize` is sync: MLX
    backends (Dia via mlx-audio) register their GPU stream on the thread that
    loaded the weights — the asyncio loop thread, since lifespan ran there.
    Sync FastAPI routes would dispatch this to a worker thread instead and
    blow up with ``RuntimeError: There is no Stream(gpu, 0) in current
    thread``. CPU backends (Kokoro) don't care either way.
    """
    engine = _tts(request)
    result = engine.synthesize(body.text, voice=body.voice, speed=body.speed)
    return result.match(
        ok=lambda audio: Response(content=audio.data, media_type=audio.media_type),
        err=_raise_internal_server_error,
    )


@app.post("/transcribe")
async def transcribe(
    request: Request,
    file: Annotated[
        UploadFile,
        File(
            description=(
                "Audio upload (e.g. WAV). Transcribed with the active STT engine "
                "(``faster-whisper small.en`` by default)."
            ),
        ),
    ],
) -> Response:
    """Transcribe uploaded audio to text and language metadata.

    **Response:** JSON ``{text, language, probability}``. Returns 503 if STT is unavailable.
    """
    engine = _stt(request)
    content = await file.read()
    result = await engine.transcribe(content, filename=file.filename)
    return result.match(
        ok=lambda t: JSONResponse(
            content={"text": t.text, "language": t.language, "probability": t.confidence},
        ),
        err=_raise_transcribe_error,
    )


def _raise_internal_server_error(exc: Exception) -> NoReturn:
    """Log *exc* and return a generic 500 (never echo exception text to clients)."""
    _log.exception("Request failed", exc_info=exc)
    raise HTTPException(status_code=500, detail="Internal server error")


def _raise_transcribe_error(exc: Exception) -> NoReturn:
    if isinstance(exc, RuntimeError) and "not loaded" in str(exc):
        _log.info("STT model not loaded")
        raise HTTPException(status_code=503, detail="Speech-to-text is unavailable.")
    _log.exception("Transcription failed", exc_info=exc)
    raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    # Loopback by default; use `uvicorn server:app --host 0.0.0.0` for LAN access.
    uvicorn.run(app, host="127.0.0.1", port=8000)
