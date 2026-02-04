import { useEffect, useRef, useState, useCallback } from "react";
import { McpManager, type ServerStatus } from "../../../sdk/mcp.js";

export interface UseMcpStatusesOptions {
  configPath: string;
}

export interface UseMcpStatusesResult {
  statuses: ServerStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMcpStatuses({ configPath }: UseMcpStatusesOptions): UseMcpStatusesResult {
  const [statuses, setStatuses] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const managerRef = useRef<McpManager | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      managerRef.current?.close();
      const manager = new McpManager();
      managerRef.current = manager;
      const result = await manager.loadConfigAndGetStatuses(configPath);
      setStatuses(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [configPath]);

  useEffect(() => {
    load();
    return () => {
      managerRef.current?.close();
    };
  }, [load]);

  return { statuses, loading, error, refresh: load };
}
