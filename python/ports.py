"""Hexagonal ports for inference engines.

Routes in :mod:`server` depend on these :class:`Protocol` types only — never on
a specific Kokoro/Whisper/Dia import. Concrete adapters in :mod:`adapters` plug
in via the composition root (:mod:`composition`), keeping engine-specific
imports (CUDA, MLX, kokoro, faster_whisper) out of the request path.

Design choices for ergonomics:

* **Keyword-only** ``voice`` / ``speed`` — prevents arg-order bugs and lets
  adapters add new options without breaking callers.
* **Domain dataclasses** (:class:`Audio`, :class:`Transcription`) — callers don't
  juggle tuples or assume a sample rate; the type carries it.
* **Frozen + slots** — values are immutable, cheap to construct.

Adding a new engine = new adapter file + branch in composition. No route change.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from result import Result


@dataclass(frozen=True, slots=True)
class Audio:
    """WAV-encoded audio produced by a :class:`TtsEngine`."""

    data: bytes
    sample_rate: int
    media_type: str = "audio/wav"


@dataclass(frozen=True, slots=True)
class Transcription:
    """Result of an :class:`SttEngine` call."""

    text: str
    language: str = ""
    confidence: float = 0.0


@dataclass(frozen=True, slots=True)
class Voice:
    """Lightweight voice descriptor — id + optional human-readable label."""

    id: str
    label: str | None = None
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class VoiceReference:
    """Reference-audio voice conditioning for engines that support cloning
    (Dia today; F5/Sesame in the future). The transcript pairs the audio
    with its content so the model can disentangle voice from text."""

    audio_path: str
    transcript: str


@runtime_checkable
class TtsEngine(Protocol):
    """Synchronous text-to-speech engine.

    Implementations load heavy weights once at construction time and reuse for
    every :meth:`synthesize` call. :attr:`name` is the stable backend id used
    in logs and the ``/health`` payload.
    """

    name: str

    def voices(self) -> Result[list[Voice], Exception]:
        """Voice descriptors this engine accepts in :meth:`synthesize`."""

    def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,
        reference: VoiceReference | None = None,
    ) -> Result[Audio, Exception]:
        """Render ``text`` as :class:`Audio`.

        ``voice=None`` → adapter default. ``reference`` is honoured by engines
        that support voice cloning (Dia); other engines ignore it silently.
        """


@runtime_checkable
class SttEngine(Protocol):
    """Asynchronous speech-to-text engine."""

    name: str

    async def transcribe(
        self,
        audio: bytes,
        *,
        filename: str | None = None,
    ) -> Result[Transcription, Exception]:
        """Return a :class:`Transcription`.

        ``language`` / ``confidence`` may be empty/zero for engines that don't
        expose them — callers should treat both as best-effort metadata.
        """
