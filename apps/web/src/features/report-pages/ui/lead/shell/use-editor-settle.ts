"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export const SETTLE_MS = 15_000;
const WAIT_MESSAGE = "Wait for the current update to finish, then try again.";

interface Waiter {
  readonly check: () => void;
  readonly cancel: () => void;
}

/**
 * Lets an action wait for the editor to reach a state instead of being dropped
 * while an outcome command or a save is in flight. `until` resolves with the
 * first committed editor that satisfies the predicate, or null on timeout or
 * unmount, so a caller can always report what did not happen.
 */
export function useEditorSettle(editor: ReadyEditor | null) {
  const latest = useRef(editor);
  const waiters = useRef(new Set<Waiter>());

  useEffect(() => {
    latest.current = editor;
    for (const waiter of [...waiters.current]) waiter.check();
  });
  useEffect(() => {
    const pending = waiters.current;
    return () => {
      for (const waiter of [...pending]) waiter.cancel();
    };
  }, []);

  const until = useCallback(
    (
      predicate: (ready: ReadyEditor) => boolean,
      timeoutMs: number = SETTLE_MS,
    ): Promise<ReadyEditor | null> =>
      new Promise((resolve) => {
        const finish = (value: ReadyEditor | null) => {
          clearTimeout(timer);
          waiters.current.delete(waiter);
          resolve(value);
        };
        const waiter: Waiter = {
          check: () => {
            const ready = latest.current;
            if (ready !== null && predicate(ready)) finish(ready);
          },
          cancel: () => finish(null),
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        waiters.current.add(waiter);
        waiter.check();
      }),
    [],
  );

  // Runs now when no outcome command is in flight, otherwise right after it.
  const whenIdle = useCallback(
    (action: (ready: ReadyEditor) => void): void => {
      const ready = latest.current;
      if (ready !== null && !ready.outcomes.pending) {
        action(ready);
        return;
      }
      void until((next) => !next.outcomes.pending).then((next) => {
        if (next) action(next);
        else toast.error(WAIT_MESSAGE);
      });
    },
    [until],
  );

  return { until, whenIdle, latest };
}
