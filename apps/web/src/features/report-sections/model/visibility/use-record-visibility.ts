"use client";

import { useCallback, useState } from "react";

// Lead form Record visibility: "mine" (default) vs "everyone" (co-owners read-only).
export type RecordVisibility = "mine" | "everyone";

const STORAGE_PREFIX = "leadRecordVisibility";

// Keyed by user AND reportId so "everyone" never bleeds across identities or reports.
function storageKey(
  userId: string | null,
  reportId: string | null,
): string | null {
  if (!userId || !reportId) return null;
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

interface ResolvedVisibility {
  key: string | null;
  value: string | null;
}

interface UseRecordVisibilityResult {
  visibility: RecordVisibility;
  // Full-content fetch must wait so it never races the pre-hydration "mine" default.
  hydrated: boolean;
  setVisibility: (next: RecordVisibility) => void;
}

export function useRecordVisibility(
  userId: string | null,
  reportId: string | null,
): UseRecordVisibilityResult {
  const currentKey = storageKey(userId, reportId);

  // Key-bound resolved value; re-scoped during render (adjusting-state pattern)
  // so a user/report change re-reads localStorage without an effect-driven
  // cascading render. `hydrated` is false until the current key has resolved.
  const [resolved, setResolved] = useState<ResolvedVisibility>(() => ({
    key: currentKey,
    value: currentKey === null ? null : readStored(currentKey),
  }));

  if (resolved.key !== currentKey) {
    setResolved({
      key: currentKey,
      value: currentKey === null ? null : readStored(currentKey),
    });
  }

  const visibility = resolved.value === "everyone" ? "everyone" : "mine";
  const hydrated = currentKey !== null && resolved.key === currentKey;

  const setVisibility = useCallback(
    (next: RecordVisibility) => {
      if (currentKey) writeStored(currentKey, next);
      setResolved({ key: currentKey, value: next });
    },
    [currentKey],
  );

  return { visibility, hydrated, setVisibility };
}
