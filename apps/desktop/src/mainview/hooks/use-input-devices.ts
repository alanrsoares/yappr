import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

export interface InputDevice {
  deviceId: string;
  label: string;
}

export interface UseInputDevicesResult {
  devices: InputDevice[];
  /** True once `getUserMedia` has been accepted at least once — labels are
   *  blank until permission is granted, so the UI uses this to gate the
   *  picker behind a "Grant mic access" button. */
  permissionGranted: boolean;
  /** Re-query `enumerateDevices` (invalidates the TanStack Query cache). */
  refresh: () => Promise<void>;
  /** Prompt the user for mic access, then refresh. Returns true on success. */
  requestPermission: () => Promise<boolean>;
}

const QUERY_KEY = ["audio-devices"] as const;

const fetchDevices = async (): Promise<MediaDeviceInfo[]> =>
  !navigator.mediaDevices?.enumerateDevices
    ? []
    : navigator.mediaDevices.enumerateDevices();

export function useInputDevices(): UseInputDevicesResult {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDevices,
    staleTime: 30_000,
  });

  // The `devicechange` event fires when devices are added/removed; treat it
  // as a cache invalidation signal so the next render re-enumerates.
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const onChange = () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [queryClient]);

  const permission = useMutation({
    mutationFn: async (): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        for (const track of stream.getTracks()) track.stop();
        return true;
      } catch {
        return false;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const devices = useMemo<InputDevice[]>(
    () =>
      (data ?? [])
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        })),
    [data],
  );

  // Browsers withhold device labels until the user has granted mic permission
  // at least once for the origin. A non-empty label is the only reliable
  // cross-engine signal that permission has been granted.
  const permissionGranted = useMemo(
    () => (data ?? []).some((d) => d.kind === "audioinput" && d.label !== ""),
    [data],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const requestPermission = useCallback(
    () => permission.mutateAsync(),
    [permission],
  );

  return { devices, permissionGranted, refresh, requestPermission };
}
