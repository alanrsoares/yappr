import { Cause, Effect, Exit } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseQueryOptions {
  enabled?: boolean;
  deps?: unknown[];
}

export interface UseQueryResult<T, E> {
  data: T | undefined;
  error: E | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
}

export function useQuery<T, E = Error>(
  queryFn: () => Effect.Effect<T, E>,
  options: UseQueryOptions = {},
): UseQueryResult<T, E> {
  const { enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<E | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const queryFnRef = useRef(queryFn);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const run = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Effect.runPromiseExit(queryFnRef.current())
      .then((exit) =>
        Exit.match(exit, {
          onSuccess: (value) => {
            setData(value);
            setError(null);
          },
          onFailure: (cause) => {
            // squash yields the Effect.fail value (the E) for typed failures,
            // or the defect for unexpected throws.
            setError(Cause.squash(cause) as E);
            setData(undefined);
          },
        }),
      )
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }
    const timeoutId = setTimeout(run, 0);
    return () => clearTimeout(timeoutId);
  }, [enabled, run, ...deps]);

  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    isSuccess: data !== undefined && error === null,
    refetch: run,
  };
}
