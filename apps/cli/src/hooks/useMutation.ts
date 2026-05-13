import { useCallback, useState } from "react";

import { ok, type Result, type ResultAsync } from "neverthrow";

export interface UseMutationResult<T, E, V> {
  mutate: (variables: V) => Result<void, E>;
  mutateAsync: (variables: V) => ResultAsync<T, E>;
  data: T | undefined;
  error: E | null;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

export interface UseMutationOptions<T, E = Error> {
  onSuccess?: (data: T) => void;
  onError?: (err: E) => void;
}

export function useMutation<T, E = Error, V = void>(
  mutationFn: (variables: V) => ResultAsync<T, E>,
  options?: UseMutationOptions<T, E>,
): UseMutationResult<T, E, V> {
  const { onSuccess, onError } = options ?? {};
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
          onError?.(err);
        })
        .match(
          () => setIsPending(false),
          () => setIsPending(false),
        );
      return ok(undefined);
    },
    [mutationFn, onSuccess, onError],
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
          onError?.(err);
        })
        .andTee(() => setIsPending(false))
        .orTee(() => setIsPending(false));
    },
    [mutationFn, onSuccess, onError],
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
