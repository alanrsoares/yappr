"""Dia 1.6B TTS adapter via :mod:`mlx_audio`.

Apple Silicon native (MLX). Dia is dialogue-tuned; for single-narrator output
it still works but the speaker-tag UX (``[S1] ... [S2] ...``) is what shines
in :mod:`briefing-podcast`-style flows. License: Apache 2.0 (clean for any use).

Voice catalog is intentionally minimal — Dia conditions on text and a small
preset set rather than the 20+ Kokoro voice ids. ``synthesize(voice=…)``
forwards to mlx-audio verbatim; unknown ids fall back to the default voice.
``speed`` is accepted for port parity but Dia ignores it today.
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]

from ports import Audio, TtsEngine, Voice
from result import Err, Ok, Result

# mlx-audio repo. fp16 fits Apple Silicon comfortably (~3.2 GB RAM during inference).
DIA_MODEL_ID = "mlx-community/Dia-1.6B-fp16"

_SAMPLE_RATE = 44_100
_DEFAULT_VOICE = "default_voice"

DIA_VOICES: list[str] = [_DEFAULT_VOICE]


class DiaEngine(TtsEngine):
    """Adapter for ``mlx-community/Dia-1.6B-fp16`` via :mod:`mlx_audio.tts`."""

    name = "dia"

    def __init__(self, model: Any) -> None:
        self._model = model

    @classmethod
    def load(cls, model_id: str = DIA_MODEL_ID) -> DiaEngine:
        from mlx_audio.tts.utils import load_model

        return cls(load_model(model_id))

    def voices(self) -> Result[list[Voice], Exception]:
        return Ok([Voice(id=v, tags=("dialogue",)) for v in DIA_VOICES])

    def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,  # noqa: ARG002 — Dia has no speed knob today
    ) -> Result[Audio, Exception]:
        try:
            import mlx.core as mx

            results = list(
                self._model.generate(text=text, voice=voice or _DEFAULT_VOICE)
            )
            if not results:
                return Err(ValueError("Dia produced no audio (empty text?)"))

            # mlx is lazy — force evaluation before we read into numpy, otherwise
            # the buffer view may hold uninitialized memory (= hellish noise).
            chunks: list[np.ndarray] = []
            for result in results:
                audio_mx = result.audio
                mx.eval(audio_mx)
                arr = np.array(audio_mx, copy=False)
                if arr.ndim > 1:
                    arr = arr.squeeze()
                chunks.append(arr.astype(np.float32, copy=False))

            audio_np = chunks[0] if len(chunks) == 1 else np.concatenate(chunks)
            buffer = io.BytesIO()
            sf.write(
                buffer,
                audio_np,
                _SAMPLE_RATE,
                format="WAV",
                subtype="PCM_16",
            )
            buffer.seek(0)
            return Ok(Audio(data=buffer.read(), sample_rate=_SAMPLE_RATE))
        except Exception as exc:  # noqa: BLE001 — boundary
            return Err(exc)
