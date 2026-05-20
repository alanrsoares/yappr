"""Guard against Kokoro voice-list drift between Python daemon and TS SDK.

The daemon's ``GET /voices`` and ``@yappr/sdk``'s ``KOKORO_VOICES`` constant
must list the same IDs in the same order. The constant is the apps' boot-time
fallback; the daemon is the runtime authority. If they diverge, apps would
render a picker that disagrees with what the server actually synthesises.
"""

from __future__ import annotations

import re
from pathlib import Path

import core

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
    return [v.strip().strip(",").strip('"').strip("'") for v in match.group(1).split() if v.strip(",").strip()]


def test_python_and_sdk_voice_lists_match() -> None:
    sdk_voices = _read_sdk_voices()
    result = core.get_voices()
    py_voices = result.match(ok=lambda v: v, err=lambda _: [])
    assert py_voices == sdk_voices, (
        "Kokoro voice list drift between python/core.py and "
        "packages/sdk/src/kokoro-voices.ts — update both."
    )
