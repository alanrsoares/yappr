import { useCallback, useEffect, useRef, useState } from "react";
import type { ResultAsync } from "neverthrow";

export interface UseQueryOptions {
  /** If false, the query will not run automatically. Default true. */
  enabled?: boolean;
  /** Optional refetch when dependencies change. Default []. */
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

/**
 * Lightweight query hook for ResultAsync. Runs queryFn on mount and when deps change.
 * Type-safe: T = success data, E = error (default Error).
 */
export function useQuery<T, E = Error>(
  queryFn: () => ResultAsync<T, E>,
  options: UseQueryOptions = {},
): UseQueryResult<T, E> {
  const { enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<E | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const run = useCallback(() => {
    setIsLoading(true);
    setError(null);
    queryFnRef
      .current()
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
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    const timeoutId = setTimeout(run, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run is stable; deps drive refetch
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
