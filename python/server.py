"""
FastAPI server: **Kokoro** text-to-speech and **Whisper** speech-to-text.

HTTP routes map ``core`` ``Result`` values to JSON or binary responses. Route and
schema docstrings below are the **source of truth** for OpenAPI (see
``python/export_openapi.py`` and generated ``packages/sdk/src/schema.d.ts``).
"""

from __future__ import annotations

import logging
import os
import sys
import warnings
from contextlib import asynccontextmanager
from typing import Annotated, Any, NoReturn

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

import core

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

_log = logging.getLogger(__name__)

_pipeline: Any = None


def get_pipeline() -> Any:
    return _pipeline


def _load_tts() -> Any:
    import kokoro

    # hexgrad/Kokoro-82M is the v1.0 release on HF; upstream KModel loads kokoro-v1_0.pth from it
    # (see https://huggingface.co/hexgrad/Kokoro-82M — not v0.19 / kLegacy). Explicit repo_id silences the library warning.
    print("Loading Kokoro 82M (hexgrad/Kokoro-82M v1.0 weights, lang=a)...")
    pipeline = kokoro.KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    print("Kokoro TTS ready.")
    return pipeline


def _load_stt() -> Any:
    from faster_whisper import WhisperModel

    # `small.en` (~244M params) hallucinates dramatically less on borderline
    # audio than `base.en` (~74M) — the latter was the source of the
    # phantom "You" / "Thank you" transcripts on short clips. Still fast on
    # CPU + int8; download is ~480MB once (cached in $HF_HOME).
    model_size = os.environ.get("YAPPR_WHISPER_MODEL", "small.en")
    print(f"Loading Whisper STT model ({model_size})...")
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("Whisper model loaded successfully.")
        return model
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        return None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> Any:
    global _pipeline
    if os.environ.get("YAPPR_TEST"):
        _pipeline = None
        core.set_stt_model(None)
        yield
        return
    try:
        _pipeline = _load_tts()
    except Exception as e:
        print(f"Failed to load Kokoro model: {e}")
        sys.exit(1)
    core.set_stt_model(_load_stt())
    yield


app = FastAPI(title="Yappr Kokoro v1 TTS + Whisper STT Server", lifespan=lifespan)

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


class SynthesizeRequest(BaseModel):
    """
    JSON body for ``POST /synthesize``.

    Produces linear PCM in a WAV container via Kokoro 82M (``hexgrad/Kokoro-82M``, ``lang_code=a``).
    """

    text: str = Field(
        ...,
        description="Plain text to speak.",
    )
    voice: str = Field(
        default="af_aoede",
        description=(
            "Kokoro v1 voice id (American English: ``af_*`` / ``am_*``). "
            "See ``GET /voices`` for the supported list."
        ),
    )
    speed: float = Field(
        default=1.0,
        description="Speaking-rate multiplier (1.0 = model default).",
    )


@app.get("/voices")
def get_voices() -> Response:
    """
    List American English Kokoro v1 voice ids.

    Returns ``application/json`` with a ``voices`` array of strings (``af_*``, ``am_*``)
    for **hexgrad/Kokoro-82M** when using ``lang_code=a`` in the pipeline.
    """
    result = core.get_voices()
    return result.match(
        ok=lambda voices: JSONResponse(content={"voices": voices}),
        err=_raise_internal_server_error,
    )


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    """
    Synthesize speech from text using the loaded Kokoro pipeline.

    **Response:** ``audio/wav`` bytes (HTTP 200). Returns 503 if the TTS model failed to load.
    """
    pipeline = get_pipeline()
    if pipeline is None:
        raise HTTPException(status_code=503, detail="TTS not loaded")
    result = core.synthesize(
        pipeline,
        request.text,
        voice=request.voice,
        speed=request.speed,
    )
    return result.match(
        ok=lambda body: Response(content=body, media_type="audio/wav"),
        err=_raise_internal_server_error,
    )


@app.post("/transcribe")
async def transcribe(
    file: Annotated[
        UploadFile,
        File(
            description=(
                "Audio upload (e.g. WAV). Transcribed with faster-whisper ``base.en`` "
                "when the STT model loaded at startup."
            ),
        ),
    ],
) -> Response:
    """
    Transcribe uploaded audio to text (and language metadata).

    **Response:** JSON with ``text``, ``language``, and ``probability``. Returns 503 if STT is unavailable.
    """
    content = await file.read()
    result = await core.transcribe_upload(content, filename=file.filename)
    return result.match(
        ok=lambda t: JSONResponse(
            content={"text": t[0], "language": t[1], "probability": t[2]},
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
        raise HTTPException(
            status_code=503,
            detail="Speech-to-text is unavailable.",
        )
    _log.exception("Transcription failed", exc_info=exc)
    raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    # Loopback by default; use `uvicorn server:app --host 0.0.0.0` for LAN access.
    uvicorn.run(app, host="127.0.0.1", port=8000)
