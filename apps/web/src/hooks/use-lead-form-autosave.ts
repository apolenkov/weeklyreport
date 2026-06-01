"use client";

import type { DraftSavePayload } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidateLeadForm } from "../lib/cache-keys";
import { useTRPC } from "../lib/trpc-context";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveSnapshot {
  readonly state: AutosaveState;
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
  readonly isInFlight: boolean;
  /** Cancels the debounce timer and triggers an immediate save. */
  readonly forceSave: () => Promise<void>;
}

export interface UseLeadFormAutosaveArgs {
  readonly reportSectionId: string | null;
  readonly payload: DraftSavePayload | null;
  readonly enabled: boolean;
  readonly debounceMs?: number;
  /**
   * Optional baseline-payload key. When provided, the hook treats this exact
   * key as the last-saved snapshot — so a fresh load from the server is not
   * considered dirty until the user actually edits a field. The caller is
   * responsible for stable serialization (e.g. via the same stringify the
   * hook would produce). When omitted, dirty starts true on first non-null
   * payload (legacy behavior).
   */
  readonly initialSavedKey?: string | null;
  /**
   * Fires after every successful saveDraft. Used by the auto-snapshot path
   * in lead-form.tsx to checkpoint a version every Nth save without
   * spawning yet another effect chain. The hook is otherwise unaware of
   * snapshots — it just emits the signal.
   *
   * Named with the "Action" suffix to satisfy Next.js 16 RSC prop
   * serialization rules for "use client" entry files (TS71007).
   */
  readonly onSaveSuccessAction?: () => void;
}

const DEFAULT_DEBOUNCE_MS = 5000;

/**
 * Stable JSON serialization with sorted keys so payload diffs are deterministic
 * regardless of object construction order. Exported so callers can compute
 * the same baseline key when priming `initialSavedKey`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * Debounced autosave hook for the Lead Form.
 *
 * - Triggers `reports.saveDraft` after `debounceMs` of payload stillness.
 * - Coalesces rapid edits into a single mutation call.
 * - Tracks dirty state (current payload vs last successfully-saved payload).
 * - Attaches a `beforeunload` listener while dirty to satisfy INT-07.
 * - Skips autosave entirely when disabled (read-only or submitted).
 */
export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveSnapshot {
  const { reportSectionId, payload, enabled } = args;
  const debounceMs = args.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const initialSavedKey = args.initialSavedKey ?? null;

  const trpc = useTRPC();
  const qc = useQueryClient();

  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSavedRef = useRef<string>("");
  const inFlightRef = useRef<string>("");
  // Queued payload key: when forceSave is called while a mutation is in
  // flight, we stash the current key here and fire again after success.
  const queuedKeyRef = useRef<string | null>(null);
  // Queued payload snapshot: stashed at queue time so onSuccess fires the
  // original queued payload, not a potentially-updated payloadRef.current.
  const queuedPayloadRef = useRef<typeof payload>(null);
  // Hold the latest onSaveSuccess in a ref so changing the callback identity
  // never re-runs the debounce effect. The mutation closure reads through
  // the ref at fire time.
  const onSaveSuccessRef = useRef<(() => void) | undefined>(
    args.onSaveSuccessAction,
  );
  onSaveSuccessRef.current = args.onSaveSuccessAction;

  // Mutable ref holding the active debounce timer id so forceSave can cancel it.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prime lastSavedRef from caller-supplied baseline whenever it changes.
  // Lets the LeadForm tell us "this freshly-loaded server payload is already
  // saved" so the user doesn't see a dirty state on initial render.
  useEffect(() => {
    if (initialSavedKey !== null) {
      lastSavedRef.current = initialSavedKey;
    }
  }, [initialSavedKey]);

  const saveDraftMut = useMutation(
    trpc.reports.saveDraft.mutationOptions({
      onSuccess: () => {
        // The payload that was sent (captured at mutate time) is now persisted.
        lastSavedRef.current = inFlightRef.current;
        setState("saved");
        setLastSavedAt(new Date());
        onSaveSuccessRef.current?.();
        invalidateLeadForm(qc, trpc);

        // Fire queued save if one was requested during in-flight.
        if (queuedKeyRef.current !== null) {
          const queued = queuedPayloadRef.current;
          const queuedKey = queuedKeyRef.current;
          queuedKeyRef.current = null;
          queuedPayloadRef.current = null;
          const queuedSectionId = reportSectionIdRef.current;
          if (
            queued !== null &&
            queuedKey !== lastSavedRef.current &&
            queuedSectionId !== null
          ) {
            setState("saving");
            inFlightRef.current = queuedKey;
            void mutateAsyncRef.current({
              ...queued,
              reportSectionId: queuedSectionId,
            });
          }
        }
      },
      onError: (err: unknown) => {
        queuedKeyRef.current = null;
        setState("error");
        const msg =
          err instanceof Error && err.message ? err.message : "Autosave failed";
        toast.error(msg);
      },
    }),
  );

  const payloadKey = payload === null ? "" : stableStringify(payload);
  const dirty =
    enabled &&
    payload !== null &&
    payloadKey !== "" &&
    payloadKey !== lastSavedRef.current;

  // Stash the latest payload + mutate fn in refs so the debounce effect can
  // depend only on `payloadKey` (deep-content hash) without restarting on
  // unrelated re-renders (which would reset the debounce timer).
  const payloadRef = useRef(payload);
  const mutateRef = useRef(saveDraftMut.mutate);
  const mutateAsyncRef = useRef(saveDraftMut.mutateAsync);
  const reportSectionIdRef = useRef(reportSectionId);
  useEffect(() => {
    payloadRef.current = payload;
    mutateRef.current = saveDraftMut.mutate;
    mutateAsyncRef.current = saveDraftMut.mutateAsync;
    reportSectionIdRef.current = reportSectionId;
  });

  // Debounced save trigger.
  useEffect(() => {
    if (!enabled || !dirty || !reportSectionId) {
      return;
    }

    setState("pending");
    const timer = setTimeout(() => {
      const current = payloadRef.current;
      if (current === null) return;
      setState("saving");
      inFlightRef.current = payloadKey;
      mutateRef.current({ ...current, reportSectionId });
    }, debounceMs);

    debounceTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current === timer) {
        debounceTimerRef.current = null;
      }
    };
  }, [payloadKey, enabled, dirty, reportSectionId, debounceMs]);

  // beforeunload guard while dirty (INT-07).
  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Legacy browsers (Chrome <119, Firefox <109) require returnValue to be
      // set. Modern browsers honour preventDefault() alone. Keep both to
      // satisfy the browser matrix; the TS6385 deprecation is a compiler
      // diagnostic only and does not trigger the ESLint rule.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /**
   * Cancels the pending debounce timer and triggers an immediate save.
   * If a mutation is already in flight the current payload is queued and
   * fired automatically on success.
   */
  const forceSave = useRef<() => Promise<void>>(() => Promise.resolve());
  forceSave.current = async () => {
    const current = payloadRef.current;
    const currentKey = current === null ? "" : stableStringify(current);
    const sectionId = reportSectionIdRef.current;

    if (!enabled || current === null || currentKey === "" || !sectionId) {
      return;
    }
    if (currentKey === lastSavedRef.current) {
      // Already up-to-date — nothing to save.
      return;
    }

    // Cancel outstanding debounce timer.
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (saveDraftMut.isPending) {
      // A mutation is already in flight. Queue for after success.
      queuedKeyRef.current = currentKey;
      queuedPayloadRef.current = current;
      return;
    }

    setState("saving");
    inFlightRef.current = currentKey;
    await mutateAsyncRef.current({ ...current, reportSectionId: sectionId });
  };

  const isInFlight = saveDraftMut.isPending;

  return {
    state,
    lastSavedAt,
    dirty,
    isInFlight,
    forceSave: forceSave.current,
  };
}
