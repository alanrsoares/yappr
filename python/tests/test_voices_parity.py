"""Guard against Kokoro voice-list drift between Python adapter and TS SDK.

The Kokoro adapter's static catalog and ``@yappr/sdk``'s ``KOKORO_VOICES``
constant must list the same IDs in the same order. The constant is the apps'
boot-time fallback; the adapter is the runtime authority. If they diverge,
apps would render a picker that disagrees with what the server actually
synthesises.
"""

from __future__ import annotations

import re
from pathlib import Path

from adapters.kokoro_engine import KOKORO_VOICES as PY_KOKORO_VOICES

_SDK_FILE = (
    Path(__file__).resolve().parents[2]
    / "packages"
    / "sdk"
    / "src"
    / "kokoro-voices.ts"
)


def _read_sdk_voices() -> list[str]:
    text = _SDK_FILE.read_text(encoding="utf-8")
    match = re.search(r"KOKORO_VOICES\s*=\s*\[([^\]]+)\]", text, re.MULTILINE)
    assert match is not None, "could not locate KOKORO_VOICES in SDK source"
    return [
        v.strip().strip(",").strip('"').strip("'")
        for v in match.group(1).split()
        if v.strip(",").strip()
    ]


def test_kokoro_voices_match_sdk() -> None:
    sdk_voices = _read_sdk_voices()
    assert sdk_voices == PY_KOKORO_VOICES, (
        "Kokoro voice list drift between adapters/kokoro_engine.py and "
        "packages/sdk/src/kokoro-voices.ts — update both."
    )
