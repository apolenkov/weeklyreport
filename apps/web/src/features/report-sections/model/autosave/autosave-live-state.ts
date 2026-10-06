import type { ReportSectionReadModel } from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { isLeadFormWriteConflict } from "../lead-form/lead-form-write-port";
import { autosaveFailureMessage } from "./autosave-effects";
import type { AutosaveMutationHandle } from "./autosave-mutation";
import type {
  AutosaveRequest,
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  rebaseQueuedRequest,
  reconcileQueuedRequest,
} from "./lead-form-draft-reconcile";

// Render-owned state the engine reports into; setters are stable identities.
interface AutosaveSinks {
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly setLastSavedAt: (savedAt: Date | null) => void;
  readonly setLastSavedKey: (savedKey: string) => void;
  readonly rearmRetry: () => void;
}

type Callbacks = Pick<
  UseLeadFormAutosaveArgs,
  "onConflict" | "onSaved" | "onVersionChange"
>;

// The module's one mutable live-state holder. It never leaves this file:
// the engine exposes intent operations only, so no other file can repopulate
// or read render-owned state through a shared mutable bundle.
interface AutosaveLiveState {
  // Latest render's callbacks, re-stamped on every commit.
  callbacks: Callbacks;
  // Each section activation owns its asynchronous completions, including A→B→A.
  generation: symbol;
  // Live optimistic-lock version, advanced synchronously on save success
  // before the queued drain fires — so a drained save rebases onto the bumped
  // version instead of self-409ing on the writer's own previous save.
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

function seedLiveState(args: UseLeadFormAutosaveArgs): AutosaveLiveState {
  // Pre-bind invocation must fail loud: the stamp replaces these handles
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
    callbacks: args,
  };
}

function saveRequest(
  live: AutosaveLiveState,
  key: string,
  payload: DraftSaveContent,
): AutosaveRequest {
  return {
    key,
    payload,
    generation: live.generation,
    version: live.version,
  };
}

function cancelDebounce(live: AutosaveLiveState): void {
  if (live.debounceTimer === null) return;
  clearTimeout(live.debounceTimer);
  live.debounceTimer = null;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(live: AutosaveLiveState, sinks: AutosaveSinks): void {
  const queued = live.queued;
  live.queued = null;
  if (queued === null) return;
  const current = queued.generation === live.generation;
  if (current && (!live.enabled || queued.key === live.lastSaved)) return;
  if (current) sinks.setState("saving");
  live.mutate({
    ...queued,
    version: current ? Math.max(live.version, queued.version) : queued.version,
  });
}

function saveSucceeded(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  saved: ReportSectionReadModel,
  request: AutosaveRequest,
): void {
  const { payload, generation } = request;
  if (
    generation !== live.generation ||
    saved.reportSectionId !== live.sectionId ||
    saved.version < live.version
  ) {
    if (generation !== live.generation) {
      const reconciled = reconcileQueuedRequest(
        live.queued,
        generation,
        saved,
        payload,
      );
      if (reconciled !== null) live.queued = reconciled;
    }
    drainQueuedSave(live, sinks);
    return;
  }
  // Bump version before the drain so a queued save rebases instead of
  // self-409ing on the writer's own previous save.
  live.version = saved.version;
  live.callbacks.onVersionChange(saved.version);

  const queued = live.queued?.generation === generation ? live.queued : null;
  const reconciliation = live.callbacks.onSaved?.(
    saved,
    payload,
    queued?.payload ?? null,
  );
  if (reconciliation && queued) {
    live.queued = rebaseQueuedRequest(
      queued,
      reconciliation.queuedPayload,
      saved.version,
    );
  }
  const savedKey = reconciliation?.savedKey ?? request.key;
  live.lastSaved = savedKey;
  sinks.setLastSavedKey(savedKey);
  sinks.setState("saved");
  sinks.setLastSavedAt(new Date());
  drainQueuedSave(live, sinks);
}

function saveFailed(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  err: unknown,
  generation: symbol,
): void {
  if (generation !== live.generation) {
    if (live.queued?.generation === generation) live.queued = null;
    drainQueuedSave(live, sinks);
    return;
  }
  const queuedSectionId = live.queued?.payload.reportSectionId ?? null;
  live.queued = null;
  sinks.setState("error");
  // A 409 hands off to the conflict flow (refetch): retrying the stale
  // version would just 409 again.
  if (live.callbacks.onConflict && isLeadFormWriteConflict(err)) {
    live.callbacks.onConflict();
    return;
  }
  // Re-arm only if the queued edit still targets the form's current section.
  if (queuedSectionId !== null && queuedSectionId === live.sectionId) {
    sinks.rearmRetry();
  }
  toast.error(autosaveFailureMessage(err));
}

// Re-syncs every live value from the latest commit.
function stampLiveState(
  live: AutosaveLiveState,
  args: UseLeadFormAutosaveArgs,
  mutation: AutosaveMutationHandle,
): void {
  if (live.sectionId !== args.reportSectionId) {
    live.generation = Symbol("autosave-generation");
  }
  live.payload = args.payload;
  live.sectionId = args.reportSectionId;
  live.enabled = args.enabled;
  live.mutate = mutation.mutate;
  live.mutateAsync = mutation.mutateAsync;
  live.isPending = mutation.isPending;
  live.callbacks = args;
  // Re-sync the live version from the prop (e.g. a reseed after fillFrom or
  // a conflict refetch). A successful save advances it ahead of this in the
  // same tick; the prop catches up on the next render.
  live.version = args.version;
}

// When a save is already in flight the payload is stashed for the success
// drain instead of starting a second parallel mutation on the single
// in-flight slot (mirrors forceSave's guard); otherwise the save starts with
// the live version injected.
function fireDebouncedSave(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  payloadKey: string,
  reportSectionId: string,
): void {
  const current = live.payload;
  if (current === null) return;
  if (live.isPending) {
    live.queued = saveRequest(live, payloadKey, current);
    return;
  }
  sinks.setState("saving");
  live.mutate(saveRequest(live, payloadKey, { ...current, reportSectionId }));
}

async function forceSaveNow(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
): Promise<void> {
  const current = live.payload;
  const currentKey =
    current === null ? "" : encodeDraftSaveComparisonKey(current);
  const sectionId = live.sectionId;
  if (!live.enabled || current === null || currentKey === "" || !sectionId) {
    return;
  }
  // Already up-to-date — nothing to save.
  if (currentKey === live.lastSaved) return;

  cancelDebounce(live);
  if (live.isPending) {
    live.queued = saveRequest(live, currentKey, current);
    return;
  }
  sinks.setState("saving");
  try {
    await live.mutateAsync(
      saveRequest(live, currentKey, { ...current, reportSectionId: sectionId }),
    );
  } catch {
    // The mutation's onError already surfaced this failure (toast + error
    // state → Retry); forceSave must not reject the caller's promise on top.
  }
}

// The autosave engine: one unit that owns the live holder and exposes only
// intent operations. Every operation is a stable identity.
export function createAutosaveEngine(
  args: UseLeadFormAutosaveArgs,
  sinks: AutosaveSinks,
) {
  const live = seedLiveState(args);
  return {
    stamp: (next: UseLeadFormAutosaveArgs, mutation: AutosaveMutationHandle) =>
      stampLiveState(live, next, mutation),
    onSaveSuccess: (saved: ReportSectionReadModel, request: AutosaveRequest) =>
      saveSucceeded(live, sinks, saved, request),
    onSaveError: (err: unknown, generation: symbol) =>
      saveFailed(live, sinks, err, generation),
    // Announces the pending save and arms the debounce; returns its cleanup.
    armDebounce: (
      payloadKey: string,
      reportSectionId: string,
      debounceMs: number,
    ) => {
      sinks.setState("pending");
      const timer = setTimeout(
        () => fireDebouncedSave(live, sinks, payloadKey, reportSectionId),
        debounceMs,
      );
      live.debounceTimer = timer;
      return () => {
        clearTimeout(timer);
        if (live.debounceTimer === timer) live.debounceTimer = null;
      };
    },
    // Cancels the pending debounce timer and saves now; an in-flight save
    // makes it queue the current payload for the success drain instead.
    forceSave: () => forceSaveNow(live, sinks),
    primeBaseline: (savedKey: string) => {
      live.lastSaved = savedKey;
      sinks.setLastSavedKey(savedKey);
    },
    adoptBaseline: (savedKey: string, source: "read" | "write") => {
      cancelDebounce(live);
      live.lastSaved = savedKey;
      if (live.queued?.generation === live.generation) live.queued = null;
      sinks.setLastSavedKey(savedKey);
      sinks.setState(source === "write" ? "saved" : "idle");
      sinks.setLastSavedAt(source === "write" ? new Date() : null);
    },
    dispose: () => {
      live.generation = Symbol("unmounted-autosave");
      live.enabled = false;
      live.queued = null;
    },
  };
}
