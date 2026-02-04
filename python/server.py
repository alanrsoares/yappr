from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import Response, JSONResponse
import io
import soundfile as sf
import uvicorn
import sys
import numpy as np
import kokoro
import torch

import warnings
import os
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import io
import soundfile as sf
import uvicorn
import sys
import numpy as np
import kokoro
import torch
from faster_whisper import WhisperModel

# Suppress library-specific warnings for cleaner output
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Initialize FastAPI
app = FastAPI(title="Yappr Kokoro TTS + Whisper STT Server")

# --- TTS Setup ---
print("Loading Kokoro TTS model (82M)...")
try:
    # Explicitly pass repo_id to suppress warning
    pipeline = kokoro.KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
    print("Kokoro model loaded successfully.")
except Exception as e:
    print(f"Failed to load Kokoro model: {e}")
    sys.exit(1)

# --- STT Setup ---
print("Loading Whisper STT model (base.en)...")
try:
    # Run on CPU with INT8 quantization for speed/compatibility on Mac
    stt_model = WhisperModel("base.en", device="cpu", compute_type="int8")
    print("Whisper model loaded successfully.")
except Exception as e:
    print(f"Failed to load Whisper model: {e}")
    # We don't exit here, allowing TTS to work even if STT fails
    stt_model = None

class SynthesizeRequest(BaseModel):
    text: str
    voice: str = "af_bella" # Default voice
    speed: float = 1.0

@app.get("/voices")
def get_voices():
    """List available voices (hardcoded common ones for now as discovery is complex)."""
    # Kokoro has many voices, we'll list a few popular ones.
    # Voices are typically: af_* (American Female), am_* (American Male), bf_* (British Female), etc.
    voices = [
        "af_bella", "af_sarah", "af_nicole", "af_sky",
        "am_adam", "am_michael", "am_eric", "am_fenrir",
        "bf_emma", "bf_isabella", "bm_george", "bm_lewis"
    ]
    return JSONResponse(content={"voices": voices})

@app.post("/synthesize")
def synthesize(request: SynthesizeRequest):
    """Synthesize text to speech using Kokoro."""
    try:
        # Pipeline returns a generator, we consume it all to create one audio file
        generator = pipeline(request.text, voice=request.voice, speed=request.speed)
        
        all_audio = []
        for _, _, audio in generator:
            all_audio.append(audio)
            
        if not all_audio:
            raise HTTPException(status_code=400, detail="No audio generated (empty text?)")
            
        # Concatenate all audio segments
        full_audio = np.concatenate(all_audio)
        
        # Convert to WAV in memory
        buffer = io.BytesIO()
        # Kokoro usually defaults to 24000Hz
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)
        
        return Response(content=buffer.read(), media_type="audio/wav")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Transcribe uploaded audio file using Whisper."""
    if not stt_model:
        raise HTTPException(status_code=503, detail="STT model not loaded")
    
    try:
        # Save uploaded file to temp
        suffix = os.path.splitext(file.filename)[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        
        segments, info = stt_model.transcribe(tmp_path, beam_size=5)
        
        text = " ".join([segment.text for segment in segments]).strip()
        
        # Cleanup
        os.unlink(tmp_path)
        
        return {"text": text, "language": info.language, "probability": info.language_probability}
        
    except Exception as e:
        print(f"Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
