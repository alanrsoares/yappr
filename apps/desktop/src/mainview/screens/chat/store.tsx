import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createContainer } from "@yappr/lib/unstated";

import { dbRpc } from "~/lib/db-rpc";
import { preferencesOptions } from "~/lib/queries";

/**
 * Chat-feature container — colocated with the screen it powers, mirroring
 * the CLI's per-screen store layout (apps/cli/src/screens/[name]/store.tsx).
 * Owns chat-only state that should not leak into the cross-screen voice
 * runtime (TTS/STT/health).
 *
 * Today: the selected MediaDevices deviceId for dictation. Future: draft,
 * active conversation, file uploads, etc. can migrate in.
 */
export interface ChatStoreValue {
  /** MediaDevices `deviceId` to use as `getUserMedia` input. `null` = system
   *  default. Persisted to the `defaultInputDeviceId` preference key. */
  inputDeviceId: string | null;
  setInputDeviceId: (v: string | null) => void;
}

function useChatStoreLogic(): ChatStoreValue {
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(null);

  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    if (typeof prefs.defaultInputDeviceId === "string") {
      // Empty string round-trips as "system default" (null on the renderer
      // side). See `setInputDeviceIdPersist` below for the inverse.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputDeviceId(prefs.defaultInputDeviceId || null);
    }
    hydratedRef.current = true;
  }, [prefs]);

  const persistPrefs = useMutation({
    mutationFn: (entries: Record<string, unknown>) =>
      dbRpc.request("preferences:setMany", entries),
  });

  const setInputDeviceIdPersist = useCallback(
    (next: string | null) => {
      setInputDeviceId(next);
      persistPrefs.mutate({ defaultInputDeviceId: next ?? "" });
    },
    [persistPrefs],
  );

  return useMemo<ChatStoreValue>(
    () => ({
      inputDeviceId,
      setInputDeviceId: setInputDeviceIdPersist,
    }),
    [inputDeviceId, setInputDeviceIdPersist],
  );
}

export const { useContainer: useChatStore, Provider: ChatStoreProvider } =
  createContainer<ChatStoreValue>(useChatStoreLogic);
