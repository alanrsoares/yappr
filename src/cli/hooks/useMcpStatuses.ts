import { useCallback, useEffect, useRef, useState } from "react";

import { McpManager, type ServerStatus } from "../../sdk/mcp.js";

export interface UseMcpStatusesOptions {
  configPath: string;
}

export interface UseMcpStatusesResult {
  statuses: ServerStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMcpStatuses({
  configPath,
}: UseMcpStatusesOptions): UseMcpStatusesResult {
  const [statuses, setStatuses] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const managerRef = useRef<McpManager | null>(null);

  const load = useCallback((): Promise<void> => {
    setLoading(true);
    setError(null);
    managerRef.current?.close();
    const manager = new McpManager();
    managerRef.current = manager;
    return manager
      .loadConfigAndGetStatuses(configPath)
      .match(
        (statuses) => {
          setStatuses(statuses);
          setError(null);
        },
        (e) => {
          setError(e.message);
          setStatuses([]);
        },
      )
      .finally(() => setLoading(false));
  }, [configPath]);

  useEffect(() => {
    const timeoutId = setTimeout(() => load(), 0);
    return () => {
      clearTimeout(timeoutId);
      managerRef.current?.close();
    };
  }, [load]);

  return { statuses, loading, error, refresh: load };
}
