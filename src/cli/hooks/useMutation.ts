import { useCallback, useState } from "react";
import type { ResultAsync } from "neverthrow";

export interface UseMutationResult<T, E, V> {
  /** Trigger the mutation with optional variables. */
  mutate: (variables: V) => void;
  /** Trigger and await the Result. Useful when you need the result. */
  mutateAsync: (variables: V) => Promise<{ data: T } | { error: E }>;
  data: T | undefined;
  error: E | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  /** Clear data and error. */
  reset: () => void;
}

/**
 * Lightweight mutation hook for ResultAsync. Does not run automatically; call mutate() to run.
 * Type-safe: T = success data, E = error (default Error), V = variables (default void).
 */
export function useMutation<T, E = Error, V = void>(
  mutationFn: (variables: V) => ResultAsync<T, E>,
): UseMutationResult<T, E, V> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<E | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    (variables: V) => {
      setIsPending(true);
      setError(null);
      setData(undefined);
      mutationFn(variables)
        .match(
          (value) => {
            setData(value);
            setError(null);
          },
          (err) => {
            setError(err);
            setData(undefined);
          },
        )
        .finally(() => setIsPending(false));
    },
    [mutationFn],
  );

  const mutateAsync = useCallback(
    async (variables: V): Promise<{ data: T } | { error: E }> => {
      setIsPending(true);
      setError(null);
      setData(undefined);
      const result = await mutationFn(variables);
      return result.match(
        (value) => {
          setData(value);
          setError(null);
          setIsPending(false);
          return { data: value } as { data: T };
        },
        (err) => {
          setError(err);
          setData(undefined);
          setIsPending(false);
          return { error: err } as { error: E };
        },
      );
    },
    [mutationFn],
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
