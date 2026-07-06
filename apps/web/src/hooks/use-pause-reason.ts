"use client";

import { useCallback, useState } from "react";

interface PauseReasonPrompt<TItem> {
  /** The item awaiting a reason, or null when the prompt is closed. */
  readonly pending: TItem | null;
  /** Open the prompt for an item. */
  readonly request: (item: TItem) => void;
  /** Commit the reason and close. */
  readonly confirm: (reason: string) => void;
  /** Close without pausing. */
  readonly cancel: () => void;
}

/**
 * require-paused-item-reason: owns the pause-reason prompt lifecycle for a
 * board section. Kept out of the section component so the section stays under
 * the file-size cap and the prompt state is unit-testable in isolation. The
 * `onPause` persist callback is invoked with the confirmed reason.
 */
export function usePauseReason<TItem extends { id: string }>(
  onPause: ((id: string, reason: string) => void) | undefined,
): PauseReasonPrompt<TItem> {
  const [pending, setPending] = useState<TItem | null>(null);

  const request = useCallback((item: TItem) => setPending(item), []);
  const cancel = useCallback(() => setPending(null), []);
  const confirm = useCallback(
    (reason: string) => {
      setPending((current) => {
        if (current) onPause?.(current.id, reason);
        return null;
      });
    },
    [onPause],
  );

  return { pending, request, confirm, cancel };
}
