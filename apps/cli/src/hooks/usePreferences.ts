import { Effect } from "effect";
import { useCallback } from "react";

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences as savePreferencesToDisk,
} from "~/lib/preferences.js";
import type { Preferences } from "~/types.js";
import { useQuery } from "./useQuery.js";

export interface UsePreferencesResult {
  preferences: Preferences;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  savePreferences: (partial: Partial<Preferences>) => void;
}

export function usePreferences(): UsePreferencesResult {
  const query = useQuery(loadPreferences, { deps: [] });
  const preferences = query.data ?? DEFAULT_PREFERENCES;

  const savePreferences = useCallback(
    (partial: Partial<Preferences>) => {
      Effect.runPromise(savePreferencesToDisk(partial)).then(
        () => query.refetch(),
        () => {},
      );
    },
    [query],
  );

  return {
    preferences,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    savePreferences,
  };
}
