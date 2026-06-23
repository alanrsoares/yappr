# 1. Migrate the TypeScript stack to Effect

Date: 2026-06-24

## Status

Accepted

## Context

The TypeScript side of yappr (`packages/lib`, `packages/sdk`, `packages/db`,
`apps/cli`, `apps/desktop`) models recoverable failure with `neverthrow`
(`Result` / `ResultAsync`), with `zod` at IO boundaries and `ts-pattern` for
branching. This works, but the service core — MCP tool lifecycle, voice/TTS/STT
clients, the inference orchestration in `chat()` — carries manual resource
cleanup (`try/finally`), manual `AbortController` threading for cancellation,
and hand-rolled dependency injection (the `ChatRuntime` object passed for
testability).

A spike (`spike/effect-chat-session`, `chatEffect()`) re-expressed `chat()` in
Effect and demonstrated, with tests, three concrete wins for that layer:

- `Scope` / `acquireRelease` guarantees MCP `close()` on success, failure, and
  interruption (no `try/finally`).
- `Layer` / `Context.Tag` turns the ad-hoc `ChatRuntime` injection into typed DI.
- Structured interruption replaces `AbortController` threading.

The cost is also real: ~50% more lines for simple flows, a neverthrow↔Effect
bridge tax during partial adoption, a larger bundle in the desktop webview, and
a genuine learning curve ("Effect owns control flow").

We are choosing to adopt Effect across the whole TS surface so the bridge tax
is temporary rather than permanent.

## Decision

1. **Error model** — domain failures at `sdk`/`db` boundaries become tagged
   errors (`Data.TaggedError`); plain `Error` elsewhere where callers only need
   a message.
2. **Coexistence** — migrate bottom-up, package by package (`lib` → `sdk` →
   `db` → `cli` → `desktop`), with temporary neverthrow↔Effect bridges at the
   seams. Each phase ships green behind its own PR.
3. **Desktop bundle** — use full Effect (not `Micro`) in the webview; the
   desktop needs `Layer`/`Scope` (chat + voice runtimes), which `Micro` lacks.
   Accept the bundle cost; code-split if it bites.
4. **TanStack Query integration** — run Effects inside `queryFn`/`mutationFn`
   via a shared `ManagedRuntime`; do not add `effect-query`. Keeps the existing
   TanStack Query/Store layer.
5. **Schema** — keep `zod` (drizzle-zod, schema-first convention). Effect Schema
   is out of scope; this migration is about the error/effect model only.

## Consequences

- A short-lived bridge module (`@yappr/lib/effect`: `fromResultAsync`,
  `toResultAsync`) lets migrated and unmigrated packages interoperate; it is
  deleted in the final cleanup phase when `neverthrow` is removed.
- `python/` is unaffected (separate runtime).
- Until cleanup, both `neverthrow` and `effect` are dependencies.

## Alternatives considered

- **Keep neverthrow** — lowest churn, but the resource-safety and cancellation
  guarantees stay manual. Rejected: we want those guarantees in the service core.
- **Effect in the service core only** — keep the UI on neverthrow permanently.
  Rejected: leaves a permanent bridge tax at every seam.
- **`Micro` in the desktop** — smaller bundle, but no `Layer`/`Scope`. Rejected:
  the desktop needs both.
