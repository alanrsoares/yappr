import { Cause, Effect, Exit } from "effect";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

import { toError } from "./result.js";

/**
 * Bridges between `neverthrow` and `effect`, used at the seams while the stack
 * migrates package by package (see docs/adr/0001-effect-migration.md). Deleted
 * in the final cleanup phase once `neverthrow` is gone.
 */

/** neverthrow → Effect: lift a `ResultAsync` into the Effect error channel. */
export const fromResultAsync = <A, E>(
  ra: ResultAsync<A, E>,
): Effect.Effect<A, E> =>
  Effect.promise(() => Promise.resolve(ra)).pipe(
    Effect.flatMap((res) =>
      res.match(
        (a) => Effect.succeed(a),
        (e) => Effect.fail(e),
      ),
    ),
  );

/**
 * Effect → neverthrow: run a fully-provided Effect (`R = never`) and collapse
 * its outcome to a `ResultAsync<A, Error>`. Failures and defects both map to
 * `Error` so neverthrow consumers keep a uniform error channel mid-migration.
 */
export const toResultAsync = <A>(
  effect: Effect.Effect<A, unknown, never>,
): ResultAsync<A, Error> =>
  ResultAsync.fromSafePromise(Effect.runPromiseExit(effect)).andThen((exit) =>
    Exit.match(exit, {
      onSuccess: (a) => okAsync(a),
      onFailure: (cause) => errAsync(toError(Cause.squash(cause))),
    }),
  );
