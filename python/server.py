"""
FastAPI server: TTS (Kokoro) + STT (Whisper). Routes delegate to core and map Result to HTTP.
"""
from __future__ import annotations

import os
import sys
import warnings
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

import core

# Suppress library warnings for cleaner logs
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Injected at startup
_pipeline: Any = None


def get_pipeline() -> Any:
    return _pipeline


def _load_tts() -> Any:
    import kokoro
    print("Loading Kokoro TTS model (82M)...")
    pipeline = kokoro.KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    print("Kokoro model loaded successfully.")
    return pipeline


def _load_stt() -> Any:
    from faster_whisper import WhisperModel
    print("Loading Whisper STT model (base.en)...")
    try:
        model = WhisperModel("base.en", device="cpu", compute_type="int8")
        print("Whisper model loaded successfully.")
        return model
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
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


app = FastAPI(title="Yappr Kokoro TTS + Whisper STT Server", lifespan=lifespan)


# --- Request/response models ---
class SynthesizeRequest(BaseModel):
    text: str
    voice: str = "af_bella"
    speed: float = 1.0


# --- Routes: core returns Result, we map to HTTP ---
@app.get("/voices")
def get_voices() -> Response:
    """List available voices."""
    result = core.get_voices()
    return result.match(
        ok=lambda voices: JSONResponse(content={"voices": voices}),
        err=lambda e: _err_response(500, str(e)),
    )


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    """Synthesize text to speech."""
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
        err=lambda e: _err_response(500, str(e)),
    )


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> Response:
    """Transcribe uploaded audio file."""
    content = await file.read()
    result = await core.transcribe_upload(content, filename=file.filename)
    return result.match(
        ok=lambda t: JSONResponse(
            content={"text": t[0], "language": t[1], "probability": t[2]},
        ),
        err=lambda e: _err_response(
            503 if "not loaded" in str(e) else 500,
            str(e),
        ),
    )


def _err_response(status_code: int, detail: str) -> Response:
    raise HTTPException(status_code=status_code, detail=detail)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
