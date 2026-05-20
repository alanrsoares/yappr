"""Concrete inbound-adapter implementations of the ports in :mod:`ports`.

Each adapter encapsulates one inference engine: model load, voice catalog,
inference call, and shape conversion to WAV bytes. Routes never import these
directly — the composition root (:mod:`composition`) hands one back as the
matching :class:`ports.TtsEngine` / :class:`ports.SttEngine`.
"""
