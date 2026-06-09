"""Hexagonal ports for inference engines.

Routes in :mod:`server` depend on these :class:`Protocol` types only — never on
a specific Kokoro/Whisper import. Concrete adapters in :mod:`adapters` plug
in via the composition root (:mod:`composition`), keeping engine-specific
imports (kokoro, faster_whisper, …) out of the request path.

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
    """Reference-audio voice conditioning for engines whose
    :attr:`TtsFeatures.cloning` is true. The transcript pairs the audio with
    its content so the model can disentangle voice from text. Engines that
    don't advertise ``cloning`` ignore it silently."""

    audio_path: str
    transcript: str


@dataclass(frozen=True, slots=True)
class TtsFeatures:
    """Capability metaconfig an adapter advertises about itself.

    Surfaced verbatim in the ``/health`` payload so apps render only the
    controls a backend actually honours — e.g. the voice-reference panel shows
    only when :attr:`cloning` is true, and the speed slider only when
    :attr:`speed` is true. This keeps engine specifics out of the UI: adding a
    cloning-capable engine lights up the panel with no client change.
    """

    cloning: bool = False
    """Honours :class:`VoiceReference` to clone the speaker in a reference WAV."""

    speed: bool = False
    """Honours the ``speed`` multiplier in :meth:`TtsEngine.synthesize`."""

    named_voices: bool = False
    """Exposes a catalog of named voice ids via :meth:`TtsEngine.voices`
    (vs. a single sentinel / reference-only voicing)."""


@runtime_checkable
class TtsEngine(Protocol):
    """Synchronous text-to-speech engine.

    Implementations load heavy weights once at construction time and reuse for
    every :meth:`synthesize` call. :attr:`name` is the stable backend id used
    in logs and the ``/health`` payload; :attr:`features` is the capability
    metaconfig apps read to drive their UI.
    """

    name: str
    features: TtsFeatures

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

        ``voice=None`` → adapter default. ``reference`` is honoured only by
        engines whose :attr:`features.cloning` is true; others ignore it.
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
