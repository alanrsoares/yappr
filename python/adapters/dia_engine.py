"""Dia 1.6B TTS adapter via :mod:`mlx_audio`.

Apple Silicon native (MLX). Dia is dialogue-tuned; for single-narrator output
we auto-prefix `[S1] ` so Dia reads the supplied text instead of freelancing
dialogue. The speaker-tag UX (``[S1] ... [S2] ...``) is what shines in
:mod:`briefing-podcast`-style flows. License: Apache 2.0.

Voice conditioning in mlx-audio Dia is via **reference audio**, not a voice
id — the ``voice`` parameter on ``model.generate`` is declared but unused
upstream. We ignore the port's ``voice`` arg for now; future work is to
expose a ``ref_audio`` path so callers can clone a specific speaker.

``speed`` is accepted for port parity but Dia has no speed control.
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

# Fallback when the model's GenerationResult doesn't carry an explicit
# sample_rate; Dia's DAC codec ships at 44.1 kHz today.
_FALLBACK_SAMPLE_RATE = 44_100

# Lower than mlx-audio's 1.3 default — calmer output, less random drift on
# short single-narrator inputs (chat replies, the Speak view).
_TEMPERATURE = 0.8
_TOP_P = 0.9

# Dia has no named voice catalog. mlx-audio's `generate(voice=…)` arg is a
# no-op; voice control is per-call reference audio (`ref_audio` + `ref_text`).
# We expose a single "auto" sentinel so the apps' voice picker isn't empty
# when Dia is the active backend; the actual sampled voice varies per call
# until reference-audio conditioning is wired through the port.
_DEFAULT_VOICE = "auto"

DIA_VOICES: list[str] = [_DEFAULT_VOICE]


def _ensure_speaker_tag(text: str) -> str:
    """Dia is a dialogue model and freelances when no speaker tag is present.

    For single-narrator inputs (everything outside `/monday-briefing`-style
    multi-host flows), force `[S1] ` so Dia treats the text as one speaker's
    monologue. Inputs that already carry `[S1]` / `[S2]` pass through.
    """
    stripped = text.lstrip()
    if stripped.startswith("[S1]") or stripped.startswith("[S2]"):
        return text
    return f"[S1] {text}"


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
        voice: str | None = None,  # noqa: ARG002 — mlx-audio Dia ignores it
        speed: float = 1.0,  # noqa: ARG002 — Dia has no speed knob today
    ) -> Result[Audio, Exception]:
        try:
            import mlx.core as mx

            results = list(
                self._model.generate(
                    text=_ensure_speaker_tag(text),
                    temperature=_TEMPERATURE,
                    top_p=_TOP_P,
                )
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
            sample_rate = (
                getattr(results[0], "sample_rate", None) or _FALLBACK_SAMPLE_RATE
            )
            buffer = io.BytesIO()
            sf.write(
                buffer,
                audio_np,
                sample_rate,
                format="WAV",
                subtype="PCM_16",
            )
            buffer.seek(0)
            return Ok(Audio(data=buffer.read(), sample_rate=sample_rate))
        except Exception as exc:  # noqa: BLE001 — boundary
            return Err(exc)
