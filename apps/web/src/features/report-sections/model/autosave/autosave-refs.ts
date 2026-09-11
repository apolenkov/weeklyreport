"use client";

import { useEffect } from "react";

import type {
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

// The mutation port used by the autosave engine.
export interface AutosaveMutationHandle {
  readonly mutate: (request: AutosaveRequest) => void;
  readonly mutateAsync: (request: AutosaveRequest) => Promise<unknown>;
  readonly isPending: boolean;
}

export interface AutosaveRequest {
  readonly key: string;
  readonly payload: DraftSaveContent;
  readonly version: number;
  readonly generation: symbol;
}

// Every mutable value the save engine reads at event time, in one bundle: the
// effects and runners take a single accessor instead of a dozen ref arguments.
export interface AutosaveRefs {
  // Each section activation owns its asynchronous completions, including A→B→A.
  generation: symbol;
  // Live optimistic-lock version, advanced synchronously in onSuccess before the
  // queued drain fires — so a drained save rebases onto the bumped version
  // instead of self-409ing on the writer's own previous save.
  version: number;
  lastSaved: string;
  // The latest queued request retains its own target, activation and version.
  queued: AutosaveRequest | null;
  // Active debounce timer id, so forceSave can cancel it.
  debounceTimer: ReturnType<typeof setTimeout> | null;
  payload: DraftSaveContent | null;
  sectionId: string | null;
  mutate: AutosaveMutationHandle["mutate"];
  mutateAsync: AutosaveMutationHandle["mutateAsync"];
  isPending: boolean;
  enabled: boolean;
}

// A stable accessor lets effects and event handlers read the current bundle.
export type GetAutosaveRefs = () => AutosaveRefs;

// The owning hook keeps this bundle stable while effects refresh live values.
export function seedAutosaveRefs(args: UseLeadFormAutosaveArgs): AutosaveRefs {
  // Pre-bind invocation must fail loud: the sync effect replaces these handles
  // before any timer or event fires, so a hit here is a wiring/ordering bug.
  const unboundMessage =
    "Autosave mutation invoked before the sync effect bound the live handle";
  return {
    generation: Symbol("autosave-generation"),
    version: args.version,
    lastSaved: "",
    queued: null,
    debounceTimer: null,
    payload: args.payload,
    sectionId: args.reportSectionId,
    mutate: () => {
      throw new Error(unboundMessage);
    },
    mutateAsync: () => Promise.reject(new Error(unboundMessage)),
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
  if (refs.sectionId !== args.reportSectionId) {
    refs.generation = Symbol("autosave-generation");
  }
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
  useEffect(
    () => () => {
      const refs = getRefs();
      refs.generation = Symbol("unmounted-autosave");
      refs.enabled = false;
      refs.queued = null;
    },
    [getRefs],
  );
}

// Lets the LeadForm say "this freshly-loaded server payload is already saved",
// so the user does not see a dirty state on initial render. Mirrors the ref
// write into state so render can read the baseline key without touching the ref.
export function usePrimedBaseline(
  getRefs: GetAutosaveRefs,
  initialSavedKey: string | null,
  setLastSavedKey: (next: string) => void,
): void {
  useEffect(() => {
    if (initialSavedKey !== null) {
      getRefs().lastSaved = initialSavedKey;
      setLastSavedKey(initialSavedKey);
    }
  }, [getRefs, initialSavedKey, setLastSavedKey]);
}
