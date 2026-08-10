"use client";

import { useCallback, useState } from "react";

interface PauseReasonPrompt<TItem> {
  readonly pending: TItem | null;
  readonly request: (item: TItem) => void;
  readonly confirm: (reason: string) => void;
  readonly cancel: () => void;
}

// Keep prompt state outside the section component for testability and file-size
// boundaries; persist only the confirmed reason.
export function usePauseReason<TItem extends { id: string }>(
  onPause: ((id: string, reason: string) => void) | undefined,
): PauseReasonPrompt<TItem> {
  const [pending, setPending] = useState<TItem | null>(null);

  const request = useCallback((item: TItem) => setPending(item), []);
  const cancel = useCallback(() => setPending(null), []);
  const confirm = useCallback(
    (reason: string) => {
      // The persist side effect stays out of the setPending updater: React MAY
      // invoke a state updater more than once for one transition (Strict Mode's
      // double-render check), which would double-fire the mutation.
      if (pending) onPause?.(pending.id, reason);
      setPending(null);
    },
    [pending, onPause],
  );

  return { pending, request, confirm, cancel };
}
