"use client";

import { useCallback, useEffect, useState } from "react";

// Lead form Record visibility: "mine" (default) vs "everyone" (co-owners read-only).
export type RecordVisibility = "mine" | "everyone";

const STORAGE_PREFIX = "leadRecordVisibility";

// Keyed by user AND reportId so "everyone" never bleeds across identities or reports.
function storageKey(userId: string | null, reportId: string): string | null {
  if (!userId || reportId === "") return null;
  return `${STORAGE_PREFIX}:${userId}:${reportId}`;
}

function readStored(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — persistence is best-effort and view-only.
  }
}

interface UseRecordVisibilityResult {
  visibility: RecordVisibility;
  // Full-content fetch must wait so it never races the pre-hydration "mine" default.
  hydrated: boolean;
  setVisibility: (next: RecordVisibility) => void;
}

/**
 * Use Record Visibility.
 * @param userId - The userId argument.
 * @param reportId - The reportId argument.
 */
export function useRecordVisibility(
  userId: string | null,
  reportId: string,
): UseRecordVisibilityResult {
  const [visibility, setVisibilityState] = useState<RecordVisibility>("mine");
  // Key-bound so `hydrated` is false on the first render after an identity/report change.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const currentKey = storageKey(userId, reportId);
  const hydrated = currentKey !== null && hydratedKey === currentKey;

  // Re-scope whenever user/report context changes; hydration is re-derived at render.
  useEffect(() => {
    if (!currentKey) {
      // Context not resolvable yet — stay on the default, unhydrated.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- re-scopes the persisted visibility from localStorage when user/report context changes — external store sync
      setVisibilityState("mine");
      setHydratedKey(null);
      return;
    }
    const stored = readStored(currentKey);
    setVisibilityState(stored === "everyone" ? "everyone" : "mine");
    setHydratedKey(currentKey);
  }, [currentKey]);

  const setVisibility = useCallback(
    (next: RecordVisibility) => {
      setVisibilityState(next);
      if (!currentKey) return;
      writeStored(currentKey, next);
    },
    [currentKey],
  );

  return { visibility, hydrated, setVisibility };
}
