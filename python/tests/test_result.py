"""Tests for Result type (neverthrow-style)."""
from __future__ import annotations

from result import Err, Ok, err, ok


def test_ok_value() -> None:
    r: Ok[int, ValueError] = ok(42)
    assert r.is_ok()
    assert not r.is_err()
    assert r.value == 42
    assert r.unwrap_or(0) == 42


def test_err_value() -> None:
    e = ValueError("bad")
    r: Err[int, ValueError] = err(e)
    assert not r.is_ok()
    assert r.is_err()
    assert r.error is e
    assert r.unwrap_or(99) == 99


def test_ok_map() -> None:
    r = ok(2).map(lambda x: x * 3)
    assert r.is_ok()
    assert r.value == 6


def test_err_map() -> None:
    e = ValueError("x")
    r: Err[int, ValueError] = err(e)
    r2 = r.map(lambda x: x + 1)
    assert r2.is_err()
    assert r2.error is e


def test_ok_match() -> None:
    r = ok(10)
    out = r.match(ok=lambda v: f"ok={v}", err=lambda e: f"err={e}")
    assert out == "ok=10"


def test_err_match() -> None:
    r = err(ValueError("fail"))
    out = r.match(ok=lambda v: f"ok={v}", err=lambda e: str(e))
    assert out == "fail"
