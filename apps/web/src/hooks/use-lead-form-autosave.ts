"use client";

import type { DraftSavePayload } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../lib/cache-keys";
import { useTRPC } from "../lib/trpc-context";
import { buildSaveDraftHandlers } from "./autosave-mutation-handlers";
import { runDebouncedSaveTick, runForceSave } from "./autosave-save-runner";
import { stableStringify } from "./autosave-stable-stringify";
import type {
  AutosaveSnapshot,
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

export { stableStringify } from "./autosave-stable-stringify";
export type {
  AutosaveSnapshot,
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

const DEFAULT_DEBOUNCE_MS = 5000;

/**
 * Debounced autosave hook for the Lead Form.
 *
 * - Triggers `reports.saveDraft` after `debounceMs` of payload stillness.
 * - Coalesces rapid edits into a single mutation call.
 * - Tracks dirty state (current payload vs last successfully-saved payload).
 * - Attaches a `beforeunload` listener while dirty to warn on unsaved edits.
 * - Skips autosave entirely when disabled (read-only or submitted).
 * @param args - The args argument.
 */
export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveSnapshot {
  const {
    reportSectionId,
    payload,
    enabled,
    version,
    onVersionChange,
    onSaved,
  } = args;
  const debounceMs = args.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const initialSavedKey = args.initialSavedKey ?? null;
  const onConflict = args.onConflict;

  const trpc = useTRPC();
  const qc = useQueryClient();

  // Live optimistic-lock version. Seeded from the `version` prop and advanced
  // SYNCHRONOUSLY inside onSuccess (from the server-confirmed value) BEFORE the
  // queued drain fires — so a drained save rebases onto the bumped version and
  // does not self-409 on the writer's own previous save.
  const versionRef = useRef(version);

  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedRetryRevision, setQueuedRetryRevision] = useState(0);

  const lastSavedRef = useRef<string>("");
  const inFlightRef = useRef<string>("");
  const inFlightPayloadRef = useRef<DraftSaveContent | null>(null);
  // The section id the in-flight save was actually sent to, captured at mutate
  // time. `onSuccess` stamps the confirmed baseline only when this still equals
  // the current section — otherwise the lead navigated away while the save was
  // in flight and stamping would clobber the new section's primed baseline.
  const inFlightSectionRef = useRef<string | null>(null);
  // Queued payload key: when forceSave is called while a mutation is in
  // flight, we stash the current key here and fire again after success.
  const queuedKeyRef = useRef<string | null>(null);
  // Queued payload snapshot: stashed at queue time so onSuccess fires the
  // original queued payload, not a potentially-updated payloadRef.current.
  const queuedPayloadRef = useRef<typeof payload>(null);

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
    trpc.reports.saveDraft.mutationOptions(
      // eslint-disable-next-line react-hooks/refs -- refs are read inside the handler closures (event time); building the deps object just runs during render
      buildSaveDraftHandlers({
        versionRef,
        lastSavedRef,
        inFlightRef,
        inFlightPayloadRef,
        inFlightSectionRef,
        queuedKeyRef,
        queuedPayloadRef,
        getMutate: () => mutateRef.current,
        getCurrentSectionId: () => reportSectionIdRef.current,
        setState,
        setLastSavedAt,
        setQueuedRetryRevision,
        onVersionChange,
        onSaved,
        onConflict,
        reportSectionId,
        invalidate: () => invalidateLeadForm(qc, trpc),
        reportError: (message) => toast.error(message),
      }),
    ),
  );

  const payloadKey = payload === null ? "" : stableStringify(payload);
  const dirty =
    enabled &&
    payload !== null &&
    payloadKey !== "" &&
    // eslint-disable-next-line react-hooks/refs -- dirty is deliberately computed from the last-saved ref at render (see comment below); making it state would re-arm the debounce on every save
    payloadKey !== lastSavedRef.current;

  // Stash the latest payload + mutate fn in refs so the debounce effect can
  // depend only on `payloadKey` (deep-content hash) without restarting on
  // unrelated re-renders (which would reset the debounce timer).
  const payloadRef = useRef(payload);
  // Seeded with a noop and populated by the sync effect below before any
  // mutation resolves — an explicit type here breaks the saveDraftMut↔mutateRef
  // inference cycle (getMutate feeds the handlers that type saveDraftMut).
  const mutateRef = useRef<(payload: DraftSavePayload) => void>(
    () => undefined,
  );
  const mutateAsyncRef = useRef(saveDraftMut.mutateAsync);
  const reportSectionIdRef = useRef(reportSectionId);
  // Live `isPending` for the debounce timer: the timer closure captures the
  // mutation object from its effect's render, so it cannot read a fresh
  // `saveDraftMut.isPending` (forceSave can — it is reassigned every render).
  const isPendingRef = useRef(saveDraftMut.isPending);
  useEffect(() => {
    payloadRef.current = payload;
    mutateRef.current = saveDraftMut.mutate;
    mutateAsyncRef.current = saveDraftMut.mutateAsync;
    reportSectionIdRef.current = reportSectionId;
    isPendingRef.current = saveDraftMut.isPending;
    // Re-sync the live version from the prop (e.g. a reseed after fillFrom or a
    // conflict refetch). A successful save's onSuccess advances it ahead of
    // this in the same tick; the prop catches up on the next render.
    versionRef.current = version;
  });

  // Debounced save trigger.
  useEffect(() => {
    if (!enabled || !dirty || !reportSectionId) {
      // A pending announcement whose edit is no longer dirty is stale — the
      // first render races the baseline-priming effect (dirty is computed at
      // render time from a ref the priming effect has not yet stamped), and a
      // user can also undo back to the saved content. Saving/saved/error
      // states are owned by the mutation callbacks and stay untouched.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced autosave state machine: pending/idle transitions are owned by the debounce timer effect
      setState((current) => (current === "pending" ? "idle" : current));
      return;
    }

    setState("pending");
    const timer = setTimeout(() => {
      runDebouncedSaveTick({
        payloadRef,
        isPendingRef,
        queuedKeyRef,
        queuedPayloadRef,
        inFlightRef,
        inFlightPayloadRef,
        inFlightSectionRef,
        versionRef,
        getMutate: () => mutateRef.current,
        setState,
        payloadKey,
        reportSectionId,
      });
    }, debounceMs);

    debounceTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current === timer) {
        debounceTimerRef.current = null;
      }
    };
  }, [
    payloadKey,
    enabled,
    dirty,
    reportSectionId,
    debounceMs,
    queuedRetryRevision,
  ]);

  // beforeunload guard while dirty.
  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Legacy browsers (Chrome <119, Firefox <109) require returnValue to be
      // set. Modern browsers honour preventDefault() alone. Keep both to
      // satisfy the browser matrix.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-browser compat; returnValue needed for Chrome <119 / Firefox <109; preventDefault() alone is insufficient there
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const forceSave = useRef<() => Promise<void>>(() => Promise.resolve());
  // eslint-disable-next-line react-hooks/refs -- latest-ref stable-callback pattern: render stamps the newest closure; consumers call it at event time
  forceSave.current = () =>
    runForceSave({
      payloadRef,
      reportSectionIdRef,
      lastSavedRef,
      debounceTimerRef,
      queuedKeyRef,
      queuedPayloadRef,
      inFlightRef,
      inFlightPayloadRef,
      inFlightSectionRef,
      versionRef,
      getMutateAsync: () => mutateAsyncRef.current,
      setState,
      enabled,
      isPending: saveDraftMut.isPending,
    });

  const isInFlight = saveDraftMut.isPending;

  return {
    state,
    lastSavedAt,
    dirty,
    isInFlight,
    // eslint-disable-next-line react-hooks/refs -- returns the latest-ref stable callback; the ref is only INVOKED from event handlers
    forceSave: forceSave.current,
  };
}
