#!/usr/bin/env python3
"""
Reproducible Kokoro TTS voice sweep: one WAV per voice + manifest.json.

Run from repo anywhere; imports resolve via this file's location::

    cd python && ./venv/bin/python scripts/assess_kokoro_voices.py
    ./venv/bin/python scripts/assess_kokoro_voices.py --output-dir ./kokoro-voice-assessment

Unset YAPPR_TEST for this process so the real pipeline loads. Default
``--output-dir`` (``kokoro-voice-assessment/``) is gitignored at repo root; use a
custom path (e.g. ``/tmp/kokoro``) if you want ``manifest.json`` under version control.

This script does **not** play sound by default — it only writes files. Use
``--play`` to run ``afplay`` (macOS) / ``aplay`` (Linux) on the first successful
WAV, or open them manually (e.g. macOS ``open`` on the output folder).

Examples::

    python scripts/assess_kokoro_voices.py --text "Hello from Kokoro."
    python scripts/assess_kokoro_voices.py --voices af_bella --play
    python scripts/assess_kokoro_voices.py --voices af_bella,am_adam --output-dir /tmp/kokoro
"""

from __future__ import annotations

import argparse
import io
import json
import os
import platform
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import soundfile as sf  # type: ignore[import-untyped]

# python/ on path (works whether cwd is python/ or repo root)
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import core  # noqa: E402, I001
from result import Err, Ok  # noqa: E402, I001


DEFAULT_TEXT = (
    "Hello. This is a fixed line for comparing Kokoro voices. "
    "Numbers one two three. How does this one sound?"
)


@dataclass(frozen=True)
class VoiceRow:
    voice: str
    file: str
    size_bytes: int
    duration_s: float
    wall_ms: float
    error: str | None


def _load_pipeline() -> tuple[object, str]:
    import kokoro

    version = getattr(kokoro, "__version__", "unknown")
    # Explicit repo_id matches HF card https://huggingface.co/hexgrad/Kokoro-82M and silences upstream default warning.
    pipeline = kokoro.KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    return pipeline, version


def _wav_duration_s(wav_bytes: bytes) -> float:
    data, sr = sf.read(io.BytesIO(wav_bytes))
    n = data.shape[0] if data.ndim == 2 else len(data)
    return float(n) / float(sr)


def _wav_peak_abs(wav_bytes: bytes) -> float:
    data, _sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
    if data.size == 0:
        return 0.0
    flat = np.asarray(data).reshape(-1)
    return float(np.max(np.abs(flat)))


def _play_wav(path: Path) -> bool:
    """Return True if a player ran (may still be silent if the file is empty)."""
    system = platform.system()
    if system == "Darwin" and shutil.which("afplay"):
        r = subprocess.run(["afplay", str(path)], check=False)
        if r.returncode != 0:
            print(f"afplay exited {r.returncode}", file=sys.stderr, flush=True)
        return True
    if system == "Linux" and shutil.which("aplay"):
        r = subprocess.run(["aplay", str(path)], check=False)
        if r.returncode != 0:
            print(f"aplay exited {r.returncode}", file=sys.stderr, flush=True)
        return True
    print(
        "No afplay (macOS) or aplay (Linux) on PATH; play the file manually:",
        path,
        flush=True,
    )
    return False


def main() -> None:
    os.environ.pop("YAPPR_TEST", None)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("kokoro-voice-assessment"),
        help="Directory for WAV files and manifest.json (created if missing).",
    )
    parser.add_argument(
        "--text",
        default=DEFAULT_TEXT,
        help="Exact text to synthesize for every voice (reproducible across runs).",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Kokoro speed parameter (default 1.0).",
    )
    parser.add_argument(
        "--voices",
        default="",
        help="Comma-separated voice ids; default = all voices from core.get_voices().",
    )
    parser.add_argument(
        "--play",
        action="store_true",
        help="After writing, play the first successful WAV via afplay (macOS) or aplay (Linux).",
    )
    args = parser.parse_args()
    out: Path = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)

    print(
        "Writes WAV files + manifest.json (no audio unless --play).\n",
        flush=True,
    )

    voices_res = core.get_voices()
    if isinstance(voices_res, Err):
        print("get_voices failed:", voices_res.error, file=sys.stderr)
        sys.exit(1)
    assert isinstance(voices_res, Ok)
    all_voices = voices_res.value
    if args.voices.strip():
        requested = {v.strip() for v in args.voices.split(",") if v.strip()}
        unknown = requested - set(all_voices)
        if unknown:
            print("Unknown voice ids:", ", ".join(sorted(unknown)), file=sys.stderr)
            sys.exit(2)
        voices = [v for v in all_voices if v in requested]
    else:
        voices = list(all_voices)

    print("Loading Kokoro pipeline (CPU/GPU per library defaults)...", flush=True)
    t0 = time.perf_counter()
    pipeline, kokoro_version = _load_pipeline()
    load_ms = (time.perf_counter() - t0) * 1000.0
    print(f"Pipeline ready in {load_ms:.0f} ms. Synthesizing {len(voices)} voice(s)…", flush=True)

    rows: list[VoiceRow] = []
    for voice in voices:
        path = out / f"{voice}.wav"
        t1 = time.perf_counter()
        result = core.synthesize(pipeline, args.text, voice=voice, speed=args.speed)
        wall_ms = (time.perf_counter() - t1) * 1000.0
        if isinstance(result, Err):
            err = str(result.error)
            print(f"  FAIL {voice}: {err}", file=sys.stderr, flush=True)
            rows.append(
                VoiceRow(
                    voice=voice,
                    file=path.name,
                    size_bytes=0,
                    duration_s=0.0,
                    wall_ms=wall_ms,
                    error=err,
                ),
            )
            continue
        assert isinstance(result, Ok)
        body = result.value
        path.write_bytes(body)
        dur = _wav_duration_s(body)
        peak = _wav_peak_abs(body)
        if peak < 1e-5:
            print(
                f"  WARN {voice}: waveform peak ~0 ({peak:.2e}); file may sound silent.",
                file=sys.stderr,
                flush=True,
            )
        print(
            f"  ok {voice}  {len(body)} bytes  {dur:.2f}s audio  peak={peak:.4f}  {wall_ms:.0f} ms wall",
            flush=True,
        )
        rows.append(
            VoiceRow(
                voice=voice,
                file=path.name,
                size_bytes=len(body),
                duration_s=round(dur, 6),
                wall_ms=round(wall_ms, 3),
                error=None,
            ),
        )

    manifest = {
        "created_at": datetime.now(UTC).isoformat(),
        "text": args.text,
        "speed": args.speed,
        "repo_id": "hexgrad/Kokoro-82M",
        "lang_code": "a",
        "kokoro_version": kokoro_version,
        "pipeline_load_ms": round(load_ms, 3),
        "output_dir": str(out),
        "voices": [asdict(r) for r in rows],
    }
    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest_path}", flush=True)

    first_ok = next((r for r in rows if r.error is None), None)
    if first_ok is not None:
        sample_path = out / first_ok.file
        quoted = shlex.quote(str(sample_path))
        print(f"\nPlay one file (macOS/Linux): afplay {quoted}  # or aplay on Linux", flush=True)
        if platform.system() == "Darwin":
            print(f"Or: open {shlex.quote(str(out))}", flush=True)
    if args.play:
        if first_ok is None:
            print("--play skipped: no successful WAV.", file=sys.stderr, flush=True)
        else:
            sample_path = out / first_ok.file
            print(f"Playing {sample_path.name} …", flush=True)
            _play_wav(sample_path)


if __name__ == "__main__":
    main()
