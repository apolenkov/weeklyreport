"use client";

import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../lib/cache-keys";
import { isConflictError } from "../lib/trpc";
import { useTRPC } from "../lib/trpc-context";

/**
 * The autosave payload WITHOUT the optimistic-lock version. The version is lock
 * metadata, not user content: keeping it out of the payload the hook hashes
 * means a version bump never marks the form dirty, never re-seeds, and never
 * appears in the dirty/queue key. The hook injects the live version at mutate
 * time instead (so a queued drain rebases onto the freshly-bumped value).
 */
export type DraftSaveContent = Omit<DraftSavePayload, "version">;

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
  readonly payload: DraftSaveContent | null;
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
   * Row revision the next save must compare-and-set against (optimistic lock).
   * The hook seeds its live version from this and re-syncs whenever it changes
   * (e.g. a post-fillFrom or post-conflict refetch).
   */
  readonly version: number;
  /**
   * Called with the server-confirmed NEW version after every successful save.
   * The owning component is the single source of truth for the version; this
   * pushes each bump back so submit/fillFrom carry the current value.
   */
  readonly onVersionChange: (version: number) => void;
  /** Reports the server-confirmed section together with the payload it persisted. */
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
  ) => void;
  /**
   * Called when a save is rejected as a stale-version CONFLICT (409). The
   * caller refetches this section and surfaces it; when provided, the hook
   * suppresses its own generic error toast for that case.
   */
  readonly onConflict?: () => void;
}

const DEFAULT_DEBOUNCE_MS = 5000;

/**
 * Stable JSON serialization with sorted keys so payload diffs are deterministic
 * regardless of object construction order. Exported so callers can compute
 * the same baseline key when priming `initialSavedKey`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  // eslint-disable-next-line sonarjs/no-alphabetical-sort -- stable serialization for dirty-state comparison; localeCompare would break payload hashing
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
 * - Attaches a `beforeunload` listener while dirty to warn on unsaved edits.
 * - Skips autosave entirely when disabled (read-only or submitted).
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
    trpc.reports.saveDraft.mutationOptions({
      onSuccess: (saved) => {
        // Advance the live version from the server-confirmed value FIRST, so the
        // drain below rebases the queued save onto the bumped version (otherwise
        // it would replay the stale version and self-409). Then push it to the
        // owning component (single source) for submit/fillFrom.
        versionRef.current = saved.version;
        onVersionChange(saved.version);

        // Stamp the confirmed baseline ONLY if the lead is still on the section
        // this save targeted. If they navigated away while it was in flight,
        // stamping would clobber the new section's freshly-primed baseline and
        // make it falsely read dirty (scheduling a spurious save there).
        if (inFlightSectionRef.current === reportSectionIdRef.current) {
          lastSavedRef.current = inFlightRef.current;
        }
        if (inFlightPayloadRef.current !== null) {
          onSaved?.(saved, inFlightPayloadRef.current);
        }
        setState("saved");
        setLastSavedAt(new Date());
        invalidateLeadForm(qc, trpc);

        // Drain a queued save (if any) to the section it was BUILT for — never
        // the latest section. The hook is not remounted on navigation, so the
        // queued payload's own reportSectionId is the only safe target.
        if (queuedKeyRef.current !== null) {
          const queued = queuedPayloadRef.current;
          const queuedKey = queuedKeyRef.current;
          queuedKeyRef.current = null;
          queuedPayloadRef.current = null;
          if (queued !== null && queuedKey !== lastSavedRef.current) {
            setState("saving");
            inFlightRef.current = queuedKey;
            inFlightPayloadRef.current = queued;
            inFlightSectionRef.current = queued.reportSectionId;
            // Fire-and-forget: the mutation's own onSuccess/onError drive the
            // result and the next drain. `mutate` (not `mutateAsync`) so no
            // unhandled rejection leaks from a discarded promise. Inject the
            // just-bumped version so the drain compare-and-sets against it.
            mutateRef.current({ ...queued, version: versionRef.current });
          }
        }
      },
      onError: (err: unknown) => {
        queuedKeyRef.current = null;
        queuedPayloadRef.current = null;
        setState("error");
        // A stale-version 409 means another writer advanced the section; hand
        // off to the caller (refetch + surface) instead of a generic toast.
        if (onConflict && isConflictError(err)) {
          onConflict();
          return;
        }
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
      setState((current) => (current === "pending" ? "idle" : current));
      return;
    }

    setState("pending");
    const timer = setTimeout(() => {
      const current = payloadRef.current;
      if (current === null) return;
      if (isPendingRef.current) {
        // A save is already in flight — stash this payload for the onSuccess
        // drain instead of starting a second parallel mutation on the single
        // in-flight slot (mirrors forceSave's guard). Latest payload wins.
        queuedKeyRef.current = payloadKey;
        queuedPayloadRef.current = current;
        return;
      }
      setState("saving");
      inFlightRef.current = payloadKey;
      inFlightPayloadRef.current = current;
      inFlightSectionRef.current = reportSectionId;
      mutateRef.current({
        ...current,
        reportSectionId,
        version: versionRef.current,
      });
    }, debounceMs);

    debounceTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current === timer) {
        debounceTimerRef.current = null;
      }
    };
  }, [payloadKey, enabled, dirty, reportSectionId, debounceMs]);

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
    inFlightPayloadRef.current = current;
    inFlightSectionRef.current = sectionId;
    await mutateAsyncRef.current({
      ...current,
      reportSectionId: sectionId,
      version: versionRef.current,
    });
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
