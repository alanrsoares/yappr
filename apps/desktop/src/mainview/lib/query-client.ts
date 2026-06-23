import { QueryClient } from "@tanstack/react-query";

/**
 * App-wide TanStack Query client. Exported as a module singleton so non-React
 * code (TanStack Store action functions) can invalidate/refetch without going
 * through the React context.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
