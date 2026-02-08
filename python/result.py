"""
Result type for explicit error handling (neverthrow-style).
Use Ok(value) / Err(error) and .map(), .and_then(), .match() for fluent, type-safe flows.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Generic, TypeVar

T = TypeVar("T")
U = TypeVar("U")
E = TypeVar("E", bound=Exception)


class Ok(Generic[T, E]):
    """Successful result."""

    __slots__ = ("_value",)

    def __init__(self, value: T) -> None:
        self._value = value

    @property
    def value(self) -> T:
        return self._value

    def is_ok(self) -> bool:
        return True

    def is_err(self) -> bool:
        return False

    def map(self, f: Callable[[T], U]) -> Result[U, E]:
        return Ok(f(self._value))

    def and_then(self, f: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return f(self._value)

    def map_err(self, f: Callable[[E], E]) -> Result[T, E]:  # noqa: ARG002
        return self

    def match(self, ok: Callable[[T], U], err: Callable[[E], U]) -> U:  # noqa: ARG002
        return ok(self._value)

    def unwrap_or(self, default: U) -> T | U:  # noqa: ARG002
        return self._value


class Err(Generic[T, E]):
    """Failed result."""

    __slots__ = ("_error",)

    def __init__(self, error: E) -> None:
        self._error = error

    @property
    def error(self) -> E:
        return self._error

    def is_ok(self) -> bool:
        return False

    def is_err(self) -> bool:
        return True

    def map(self, f: Callable[[T], U]) -> Result[U, E]:  # noqa: ARG002
        return self  # type: ignore[return-value]

    def and_then(self, f: Callable[[T], Result[U, E]]) -> Result[U, E]:  # noqa: ARG002
        return self  # type: ignore[return-value]

    def map_err(self, f: Callable[[E], E]) -> Result[T, E]:
        return Err(f(self._error))

    def match(self, ok: Callable[[T], U], err: Callable[[E], U]) -> U:  # noqa: ARG002
        return err(self._error)

    def unwrap_or(self, default: U) -> T | U:
        return default


Result = Ok[T, E] | Err[T, E]


def ok(value: T) -> Ok[T, E]:
    """Construct a successful result."""
    return Ok(value)


def err(error: E) -> Err[T, E]:
    """Construct a failed result."""
    return Err(error)