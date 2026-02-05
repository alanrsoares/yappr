import { useCallback, useState } from "react";

import { ok, type Result, type ResultAsync } from "neverthrow";

export interface UseMutationResult<T, E, V> {
  /** Trigger the mutation (fire-and-forget). Returns Result for sync validation / fluent composition. */
  mutate: (variables: V) => Result<void, E>;
  /** Trigger and get back ResultAsync for chaining: .map(), .match(), .andThen(), etc. */
  mutateAsync: (variables: V) => ResultAsync<T, E>;
  data: T | undefined;
  error: E | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** Clear data and error. */
  reset: () => void;
}

export interface UseMutationOptions<T> {
  onSuccess?: (data: T) => void;
}

/**
 * Lightweight mutation hook for ResultAsync. Does not run automatically; call mutate() or mutateAsync() to run.
 * Type-safe: T = success data, E = error (default Error), V = variables (default void).
 * mutate returns Result for sync/fluent use; mutateAsync returns ResultAsync for chaining and awaiting.
 */
export function useMutation<T, E = Error, V = void>(
  mutationFn: (variables: V) => ResultAsync<T, E>,
  options?: UseMutationOptions<T>,
): UseMutationResult<T, E, V> {
  const { onSuccess } = options ?? {};
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<E | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    (variables: V): Result<void, E> => {
      setIsPending(true);
      setError(null);
      setData(undefined);
      mutationFn(variables)
        .andTee((value) => {
          setData(value);
          setError(null);
          onSuccess?.(value);
        })
        .orTee((err) => {
          setError(err);
          setData(undefined);
        })
        .match(
          () => setIsPending(false),
          () => setIsPending(false),
        );
      return ok(undefined);
    },
    [mutationFn, onSuccess],
  );

  const mutateAsync = useCallback(
    (variables: V): ResultAsync<T, E> => {
      setIsPending(true);
      setError(null);
      setData(undefined);
      return mutationFn(variables)
        .andTee((value) => {
          setData(value);
          setError(null);
          onSuccess?.(value);
        })
        .orTee((err) => {
          setError(err);
          setData(undefined);
        })
        .andTee(() => setIsPending(false))
        .orTee(() => setIsPending(false));
    },
    [mutationFn, onSuccess],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isPending,
    isError: error !== null,
    isSuccess: data !== undefined && error === null,
    reset,
  };
}
