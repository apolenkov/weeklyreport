import type { ReportSectionReadModel } from "@weeklyreport/shared";

import * as effects from "./autosave-effects";
import {
  type AutosaveMutationHandle,
  unboundAutosaveMutation,
} from "./autosave-mutation";
import {
  createPersistedIntentOwner,
  persistedResponseMatches,
  reconcileCurrentSave,
  settleDropped,
} from "./autosave-persisted-intent";
import {
  captureAutosaveRequest,
  createSaveRecovery,
} from "./autosave-recovery";
import {
  currentSaveRequest,
  draftSaveRequest as saveRequest,
} from "./autosave-request";
import type {
  AutosaveRequest,
  AutosaveSinks,
  PersistedSaveResult,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

interface AutosaveLiveState {
  args: UseLeadFormAutosaveArgs;
  mutation: AutosaveMutationHandle;
  persisted: ReturnType<typeof createPersistedIntentOwner>;
  recovery: ReturnType<typeof createSaveRecovery>;
  inFlight: Set<AutosaveRequest>;
  generation: symbol;
  version: number;
  lastSaved: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

function cancelDebounce(live: AutosaveLiveState): void {
  if (live.debounceTimer === null) return;
  clearTimeout(live.debounceTimer);
  live.debounceTimer = null;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(live: AutosaveLiveState, sinks: AutosaveSinks): void {
  if (live.recovery.blocked() || live.inFlight.size > 0) return;
  const queued = live.persisted.takeQueued();
  if (queued === null) return;
  const current = queued.generation === live.generation;
  if (current && !live.args.enabled) {
    settleDropped(queued, "obsolete");
    return;
  }
  if (
    current &&
    !queued.persistedAttempt &&
    (live.persisted.blocked() || queued.key === live.lastSaved)
  )
    return;
  if (current) sinks.setState("saving");
  const request = captureAutosaveRequest({
    ...queued,
    version: current ? Math.max(live.version, queued.version) : queued.version,
  });
  live.inFlight.add(request);
  live.recovery.start(request);
  live.mutation.mutate(request);
}

function saveSucceeded(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  saved: ReportSectionReadModel,
  request: AutosaveRequest,
): void {
  live.inFlight.delete(request);
  if (!live.persisted.canComplete(request)) {
    drainQueuedSave(live, sinks);
    return;
  }
  if (
    request.generation !== live.generation ||
    (!live.recovery.owns(request) &&
      saved.reportSectionId !== live.args.reportSectionId) ||
    (!live.recovery.owns(request) && saved.version < live.version)
  ) {
    settleDropped(request, "obsolete");
    live.persisted.reconcileObsolete(request, saved, live.generation);
    drainQueuedSave(live, sinks);
    return;
  }
  if (live.recovery.owns(request)) {
    if (
      !persistedResponseMatches(request, saved) ||
      saved.version < live.version
    ) {
      live.recovery.mismatch(request);
      sinks.setState("error");
      return;
    }
    live.recovery.clear();
    // Exact competitors cannot commit after the acknowledged CAS winner.
    live.inFlight.clear();
  }
  // Bump version before the drain so a queued save rebases instead of
  // self-409ing on the writer's own previous save.
  live.version = saved.version;
  live.args.onVersionChange(saved.version);

  const savedKey = reconcileCurrentSave(
    live.persisted,
    live.args.onSaved,
    saved,
    request,
  );
  live.lastSaved = savedKey;
  sinks.setLastSavedKey(savedKey);
  sinks.setState("saved");
  sinks.setLastSavedAt(new Date());
  const accepted = live.persisted.accept(request, saved);
  if (accepted) sinks.rearmRetry();
  if (accepted === false) sinks.setState("error");
  drainQueuedSave(live, sinks);
}

function saveFailed(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  err: unknown,
  request: AutosaveRequest,
): void {
  live.inFlight.delete(request);
  const { generation } = request;
  if (live.recovery.fail(request, err)) {
    effects.reportOwnedFailure(live.args, sinks, err);
    return;
  }
  if (!live.persisted.canComplete(request)) {
    drainQueuedSave(live, sinks);
    return;
  }
  request.persistedAttempt?.settle({
    status: generation === live.generation ? "failed" : "obsolete",
    token: request.persistedAttempt.token,
  });
  if (generation !== live.generation) {
    live.persisted.dropGeneration(generation);
    drainQueuedSave(live, sinks);
    return;
  }
  const queuedSectionId =
    live.persisted.queued()?.payload.reportSectionId ?? null;
  live.persisted.replaceQueued(null);
  effects.reportSaveFailure(err, {
    args: live.args,
    sinks,
    contextual: Boolean(request.persistedAttempt),
    request,
    retry:
      queuedSectionId !== null &&
      queuedSectionId === live.args.reportSectionId &&
      !live.persisted.blocked(),
  });
}

function issueSave(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  request: AutosaveRequest,
): Promise<unknown> {
  if (
    live.inFlight.size > 0 ||
    live.recovery.blocked() ||
    live.mutation.isPending
  ) {
    live.persisted.replaceQueued(request);
    return Promise.resolve();
  }
  sinks.setState("saving");
  const dispatched = captureAutosaveRequest(request);
  live.inFlight.add(dispatched);
  live.recovery.start(dispatched);
  return live.mutation.mutateAsync(dispatched);
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
  const current = live.args.payload;
  if (current === null || !live.args.enabled || live.persisted.blocked())
    return;
  void issueSave(
    live,
    sinks,
    saveRequest(live, payloadKey, { ...current, reportSectionId }),
  ).catch(() => undefined);
}

async function forceSaveNow(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
): Promise<void> {
  const request = currentSaveRequest(live.args, live);
  if (!request || live.persisted.blocked() || request.key === live.lastSaved)
    return;
  cancelDebounce(live);
  await issueSave(live, sinks, request).catch(() => undefined);
}

function savePersistedNow(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  token: string,
): Promise<PersistedSaveResult> {
  cancelDebounce(live);
  if (live.recovery.blocked())
    return Promise.resolve({ status: "failed", token });
  const current = currentSaveRequest(live.args, live);
  if (!current) return Promise.resolve({ status: "obsolete", token });
  const { request, promise } = live.persisted.create(current, token);
  void issueSave(live, sinks, request).catch(() => undefined);
  return promise;
}

// The autosave engine: one unit that owns the live holder and exposes only
// intent operations. Every operation is a stable identity.
function retrySameAttempt(live: AutosaveLiveState, token: string): boolean {
  const request = live.args.enabled ? live.recovery.retry(token) : null;
  if (request) live.mutation.mutate(request);
  return request !== null;
}

export function createAutosaveEngine(
  args: UseLeadFormAutosaveArgs,
  sinks: AutosaveSinks,
) {
  const live: AutosaveLiveState = {
    persisted: createPersistedIntentOwner(),
    recovery: createSaveRecovery((state) => sinks.setRecovery?.(state)),
    inFlight: new Set(),
    generation: Symbol("autosave-generation"),
    version: args.version,
    lastSaved: "",
    debounceTimer: null,
    args,
    mutation: unboundAutosaveMutation(),
  };
  return {
    // Re-sync every live value from the latest committed args.
    stamp: (
      next: UseLeadFormAutosaveArgs,
      mutation: AutosaveMutationHandle,
    ) => {
      if (live.args.reportSectionId !== next.reportSectionId) {
        live.recovery.clear();
        live.persisted.invalidate();
        cancelDebounce(live);
        live.generation = Symbol("autosave-generation");
      }
      live.args = next;
      live.mutation = mutation;
      // Re-sync the live version from the prop (e.g. a reseed after fillFrom or
      // a conflict refetch). A successful save advances it ahead of this in the
      // same tick; the prop catches up on the next render.
      live.version = next.version;
    },
    onSaveSuccess: (saved: ReportSectionReadModel, request: AutosaveRequest) =>
      saveSucceeded(live, sinks, saved, request),
    onSaveError: (err: unknown, request: AutosaveRequest) =>
      saveFailed(live, sinks, err, request),
    // Announces the pending save and arms the debounce; returns its cleanup.
    armDebounce: (
      payloadKey: string,
      reportSectionId: string,
      debounceMs: number,
    ) => {
      sinks.setState("pending");
      const { timer, cancel } = effects.armSaveTimer(
        () => fireDebouncedSave(live, sinks, payloadKey, reportSectionId),
        debounceMs,
      );
      live.debounceTimer = timer;
      return cancel;
    },
    // Cancels the pending debounce timer and saves now; an in-flight save
    // makes it queue the current payload for the success drain instead.
    forceSave: () => forceSaveNow(live, sinks),
    savePersisted: (token: string) => savePersistedNow(live, sinks, token),
    isRecoveryBlocked: live.recovery.blocked,
    retrySameAttempt: (token: string) => retrySameAttempt(live, token),
    abandonPersisted: (token: string) => {
      if (!live.recovery.admitsAbandon(token)) return;
      if (live.persisted.abandon(token)) sinks.rearmRetry();
    },
    primeBaseline: (savedKey: string) => {
      if (live.recovery.blocked()) return;
      live.lastSaved = savedKey;
      sinks.setLastSavedKey(savedKey);
    },
    adoptBaseline: (savedKey: string, source: "read" | "write") => {
      if (live.recovery.blocked()) return;
      cancelDebounce(live);
      live.persisted.adopt();
      live.lastSaved = savedKey;
      live.persisted.dropGeneration(live.generation);
      sinks.setLastSavedKey(savedKey);
      sinks.setState(source === "write" ? "saved" : "idle");
      sinks.setLastSavedAt(source === "write" ? new Date() : null);
    },
    dispose: () => {
      live.recovery.clear();
      live.persisted.invalidate();
      cancelDebounce(live);
      live.generation = Symbol("unmounted-autosave");
      live.args = { ...live.args, enabled: false };
      live.persisted.takeQueued();
    },
  };
}
