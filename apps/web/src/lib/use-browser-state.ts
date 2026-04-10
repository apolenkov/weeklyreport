'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * SSR-safe state hook that defers browser-specific reads until after hydration.
 *
 * During SSR and the first client render the hook returns {@link serverDefault},
 * guaranteeing identical HTML on server and client (no hydration mismatch).
 * After mount, {@link browserReader} runs in a `useEffect` and the state is
 * updated with the real browser value (e.g. from `localStorage`).
 *
 * @param serverDefault - Deterministic value used during SSR and first paint.
 * @param browserReader - Function that reads the real value from browser APIs.
 * @returns Tuple `[state, setState]` — works like `useState`.
 */
export function useBrowserState<T>(
  serverDefault: T,
  browserReader: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(serverDefault);

  useEffect(() => {
    setState(browserReader());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time post-hydration sync
  }, []);

  return [state, setState];
}
