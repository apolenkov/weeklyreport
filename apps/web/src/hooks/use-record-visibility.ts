"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * scope-lead-report-to-own-contribution (D4 / D4c): the lead form's Record
 * visibility toggle. Two states:
 *   - "mine" (default): own records only; the full-content read is not fetched.
 *   - "everyone": additionally render co-owners' full records read-only.
 */
export type RecordVisibility = "mine" | "everyone";

const STORAGE_PREFIX = "leadRecordVisibility";

/**
 * Namespaced storage key. Keyed by the current user AND reportId so an
 * "everyone" choice can never bleed across users (shared browser / dev
 * role-switcher) or across reports. Returns null when either part of the
 * context is not yet known — no read/write happens against an ambiguous key.
 */
function storageKey(userId: string | null, reportId: string): string | null {
  if (!userId || reportId === "") return null;
  return `${STORAGE_PREFIX}:${userId}:${reportId}`;
}

/**
 * Reads a key from localStorage, or null when the store is unavailable (server
 * render, or a sandboxed environment where access throws). Degrades to the
 * "mine" default rather than crashing.
 */
function readStored(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a key to localStorage; a no-op when the store is unavailable. */
function writeStored(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — persistence is best-effort and view-only.
  }
}

interface UseRecordVisibilityResult {
  /** The resolved visibility. Always "mine" until hydration completes. */
  visibility: RecordVisibility;
  /**
   * True once the persisted value has been read from localStorage for the
   * current {userId, reportId}. The gated full-content fetch MUST wait for
   * this so it never fires on the pre-hydration default and then races the
   * restored "everyone" (D4c).
   */
  hydrated: boolean;
  setVisibility: (next: RecordVisibility) => void;
}

/**
 * Reads + persists the Record visibility toggle under a per-user, per-report
 * localStorage key. The first-ever load (no matching key) defaults to "mine".
 * On any {userId, reportId} change the lookup re-scopes to the new key and
 * re-defaults to "mine" when that key is absent — a stored "everyone" is never
 * read under a different identity or report (D4c).
 */
export function useRecordVisibility(
  userId: string | null,
  reportId: string,
): UseRecordVisibilityResult {
  const [visibility, setVisibilityState] = useState<RecordVisibility>("mine");
  // The {userId, reportId} key the current `visibility` was hydrated under.
  // Binding it to the key (not a bare boolean) makes `hydrated` observably
  // false on the FIRST render after an identity/report change — before any
  // effect runs — so a stale value can never feed a dependent fetch or a
  // foreign-content merge under a new identity (closes the same-QueryClient
  // cache-leak the bare boolean missed).
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const currentKey = storageKey(userId, reportId);
  const hydrated = currentKey !== null && hydratedKey === currentKey;

  // Re-scope the lookup whenever the user/report context changes. Hydration is
  // re-derived at render from `hydratedKey === currentKey`, so it is already
  // false this render; the effect resolves the new key's stored value.
  useEffect(() => {
    if (!currentKey) {
      // Context not resolvable yet — stay on the default, unhydrated.
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
