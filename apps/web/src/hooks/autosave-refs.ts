"use client";

import type { DraftSavePayload } from "@customreport/shared";
import { useEffect } from "react";

import type {
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

// The subset of the TanStack mutation the autosave engine drives.
export interface AutosaveMutationHandle {
  readonly mutate: (payload: DraftSavePayload) => void;
  readonly mutateAsync: (payload: DraftSavePayload) => Promise<unknown>;
  readonly isPending: boolean;
}

// Every mutable value the save engine reads at event time, in one bundle: the
// effects and runners take a single accessor instead of a dozen ref arguments.
export interface AutosaveRefs {
  // Live optimistic-lock version, advanced synchronously in onSuccess before the
  // queued drain fires — so a drained save rebases onto the bumped version
  // instead of self-409ing on the writer's own previous save.
  version: number;
  lastSaved: string;
  inFlight: string;
  inFlightPayload: DraftSaveContent | null;
  // Section the in-flight save was sent to, captured at mutate time. Guards
  // onSuccess from stamping a baseline onto a section the lead navigated to
  // mid-flight, which would clobber that section's primed baseline.
  inFlightSection: string | null;
  // Payload key + snapshot stashed when a save is requested while one is in
  // flight; onSuccess drains the original queued payload, not a later edit.
  queuedKey: string | null;
  queuedPayload: DraftSaveContent | null;
  // Active debounce timer id, so forceSave can cancel it.
  debounceTimer: ReturnType<typeof setTimeout> | null;
  payload: DraftSaveContent | null;
  sectionId: string | null;
  mutate: (payload: DraftSavePayload) => void;
  mutateAsync: (payload: DraftSavePayload) => Promise<unknown>;
  isPending: boolean;
  enabled: boolean;
}

// Accessor over the bundle. Passing the ref itself would let a callee read it
// during render; a closure can only resolve at event or effect time.
export type GetAutosaveRefs = () => AutosaveRefs;

// Initial bundle. The owning hook holds the useRef itself, so the linter still
// sees — and the author must still justify — any render-time read of it.
export function seedAutosaveRefs(args: UseLeadFormAutosaveArgs): AutosaveRefs {
  return {
    version: args.version,
    lastSaved: "",
    inFlight: "",
    inFlightPayload: null,
    inFlightSection: null,
    queuedKey: null,
    queuedPayload: null,
    debounceTimer: null,
    payload: args.payload,
    sectionId: args.reportSectionId,
    // Replaced by the sync effect before any timer or event can fire.
    mutate: () => undefined,
    mutateAsync: () => Promise.resolve(),
    isPending: false,
    enabled: args.enabled,
  };
}

// Field-by-field so a renamed field breaks the build instead of silently
// dropping out of the sync.
function stampLiveValues(
  refs: AutosaveRefs,
  args: UseLeadFormAutosaveArgs,
  mutation: AutosaveMutationHandle,
): void {
  refs.payload = args.payload;
  refs.sectionId = args.reportSectionId;
  refs.enabled = args.enabled;
  refs.mutate = mutation.mutate;
  refs.mutateAsync = mutation.mutateAsync;
  refs.isPending = mutation.isPending;
  // Re-sync the live version from the prop (e.g. a reseed after fillFrom or a
  // conflict refetch). A successful save's onSuccess advances it ahead of this
  // in the same tick; the prop catches up on the next render.
  refs.version = args.version;
}

export function useSyncAutosaveRefs(
  getRefs: GetAutosaveRefs,
  args: UseLeadFormAutosaveArgs,
  mutation: AutosaveMutationHandle,
): void {
  // No dep array on purpose: every commit must re-stamp the live values.
  useEffect(() => {
    stampLiveValues(getRefs(), args, mutation);
  });
}

// Lets the LeadForm say "this freshly-loaded server payload is already saved",
// so the user does not see a dirty state on initial render.
export function usePrimedBaseline(
  getRefs: GetAutosaveRefs,
  initialSavedKey: string | null,
): void {
  useEffect(() => {
    if (initialSavedKey !== null) {
      getRefs().lastSaved = initialSavedKey;
    }
  }, [getRefs, initialSavedKey]);
}
