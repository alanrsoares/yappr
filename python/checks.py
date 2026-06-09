"""Local quality gate — entry point for ``uv run check``.

Runs the same sequence as CI (``.github/workflows/ci.yml``): ruff lint, ruff
format check, mypy, pytest. Stops at the first failure and propagates its exit
code so ``uv run check`` is a single green/red signal before pushing.
"""

from __future__ import annotations

import subprocess
import sys

_STEPS: list[list[str]] = [
    ["ruff", "check", "."],
    ["ruff", "format", "--check", "."],
    ["mypy", "."],
    ["pytest", "tests/", "-q"],
]


def main() -> int:
    for cmd in _STEPS:
        print(f"\n\033[1m▶ {' '.join(cmd)}\033[0m", flush=True)
        code = subprocess.run(cmd, check=False).returncode
        if code != 0:
            print(f"\n\033[31m✗ failed: {' '.join(cmd)}\033[0m", file=sys.stderr)
            return code
    print("\n\033[32m✓ all python checks passed\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
