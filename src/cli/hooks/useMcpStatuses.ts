import { useEffect, useRef } from "react";

import { McpManager } from "~/sdk/mcp.js";
import type { ServerStatus } from "~/sdk/types.js";
import { useQuery } from "./useQuery.js";

export interface UseMcpStatusesOptions {
  configPath: string;
}

export interface UseMcpStatusesResult {
  statuses: ServerStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMcpStatuses({
  configPath,
}: UseMcpStatusesOptions): UseMcpStatusesResult {
  const managerRef = useRef<McpManager | null>(null);

  const query = useQuery(
    () => {
      managerRef.current?.close();
      const manager = new McpManager();
      managerRef.current = manager;
      return manager.loadConfigAndGetStatuses(configPath);
    },
    { deps: [configPath] },
  );

  useEffect(
    () => () => {
      managerRef.current?.close();
    },
    [],
  );

  return {
    statuses: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refresh: query.refetch,
  };
}
