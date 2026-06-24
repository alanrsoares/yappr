import { Cause, Effect, Exit } from "effect";
import { useCallback, useState } from "react";

export interface UseMutationResult<T, E, V> {
  mutate: (variables: V) => void;
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
  mutationFn: (variables: V) => Effect.Effect<T, E>,
  options?: UseMutationOptions<T, E>,
): UseMutationResult<T, E, V> {
  const { onSuccess, onError } = options ?? {};
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<E | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    (variables: V): void => {
      setIsPending(true);
      setError(null);
      setData(undefined);
      Effect.runPromiseExit(mutationFn(variables))
        .then((exit) =>
          Exit.match(exit, {
            onSuccess: (value) => {
              setData(value);
              setError(null);
              onSuccess?.(value);
            },
            onFailure: (cause) => {
              const err = Cause.squash(cause) as E;
              setError(err);
              setData(undefined);
              onError?.(err);
            },
          }),
        )
        .finally(() => setIsPending(false));
    },
    [mutationFn, onSuccess, onError],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
  }, []);

  return {
    mutate,
    data,
    error,
    isPending,
    isError: error !== null,
    isSuccess: data !== undefined && error === null,
    reset,
  };
}
