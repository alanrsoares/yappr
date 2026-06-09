"""A minimal Rust-style ``Result`` for railway-style error handling at boundaries.

Deliberately hand-rolled rather than depending on ``returns`` or rustedpy: this is a
small, typed surface (``map``/``and_then``/``map_err``/``match``/``unwrap_or``) and a
library would only earn its keep with do-notation / ``IO`` / ``Future`` containers, none
of which this codebase uses. Swapping to one later is mechanical because the surface
matches. Adapters catch exceptions at the boundary and return ``Err``; the pure core and
the route layer stay on the rails via :meth:`match`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable


@dataclass(frozen=True, slots=True)
class Ok[T, E: Exception]:
    """Successful result carrying a value."""

    value: T

    def is_ok(self) -> bool:
        return True

    def is_err(self) -> bool:
        return False

    def map[U](self, transform: Callable[[T], U]) -> Result[U, E]:
        return Ok(transform(self.value))

    def and_then[U](self, transform: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return transform(self.value)

    def map_err[F: Exception](self, transform: Callable[[E], F]) -> Result[T, F]:
        _ = transform
        return Ok(self.value)

    def match[U](self, ok: Callable[[T], U], err: Callable[[E], U]) -> U:
        _ = err
        return ok(self.value)

    def unwrap_or[U](self, default: U) -> T | U:
        _ = default
        return self.value


@dataclass(frozen=True, slots=True)
class Err[T, E: Exception]:
    """Failed result carrying an exception."""

    error: E

    def is_ok(self) -> bool:
        return False

    def is_err(self) -> bool:
        return True

    def map[U](self, transform: Callable[[T], U]) -> Result[U, E]:
        _ = transform
        return Err(self.error)

    def and_then[U](self, transform: Callable[[T], Result[U, E]]) -> Result[U, E]:
        _ = transform
        return Err(self.error)

    def map_err[F: Exception](self, transform: Callable[[E], F]) -> Result[T, F]:
        return Err(transform(self.error))

    def match[U](self, ok: Callable[[T], U], err: Callable[[E], U]) -> U:
        _ = ok
        return err(self.error)

    def unwrap_or[U](self, default: U) -> T | U:
        return default


type Result[T, E: Exception] = Ok[T, E] | Err[T, E]


def ok[T, E: Exception](value: T) -> Ok[T, E]:
    """Construct a successful result."""
    return Ok(value)


def err[T, E: Exception](error: E) -> Err[T, E]:
    """Construct a failed result."""
    return Err(error)
