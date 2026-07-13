"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ServerSeededDraft<T> {
  readonly draft: T;
  readonly setDraft: (next: T | ((prev: T) => T)) => void;
  readonly markClean: () => void;
}

// A local draft seeded from a server value that survives background refetches.
// The draft reseeds only from FRESH server data: skip while the form is dirty
// (an in-progress edit must not be overwritten) and skip a value already
// seeded — otherwise `markClean`'s post-save dirty flip re-fires the effect
// while the source still holds the pre-save value and the just-typed field
// flickers back. `setDraft` marks the draft dirty; `markClean` clears it so the
// next distinct server value reseeds.
export function useServerSeededDraft<T>(server: T): ServerSeededDraft<T> {
  const [draft, setDraftState] = useState<T>(server);
  const [isDirty, setIsDirty] = useState(false);

  const lastSeeded = useRef<T>(server);
  useEffect(() => {
    if (!isDirty && server !== lastSeeded.current) {
      lastSeeded.current = server;
      setDraftState(server);
    }
  }, [server, isDirty]);

  const setDraft = useCallback((next: T | ((prev: T) => T)) => {
    setIsDirty(true);
    setDraftState(next);
  }, []);

  const markClean = useCallback(() => setIsDirty(false), []);

  return { draft, setDraft, markClean };
}
