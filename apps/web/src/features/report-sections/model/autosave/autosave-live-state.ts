import type { ReportSectionReadModel } from "@customreport/shared";
import { toast } from "sonner";

import { isLeadFormWriteConflict } from "../lead-form/lead-form-write-port";
import { autosaveFailureMessage } from "./autosave-effects";
import {
  type AutosaveMutationHandle,
  unboundAutosaveMutation,
} from "./autosave-mutation";
import {
  createPersistedIntentOwner,
  settleDropped,
} from "./autosave-persisted-intent";
import type {
  AutosaveRequest,
  AutosaveSinks,
  DraftSaveContent,
  PersistedSaveResult,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

interface AutosaveLiveState {
  args: UseLeadFormAutosaveArgs;
  mutation: AutosaveMutationHandle;
  persisted: ReturnType<typeof createPersistedIntentOwner>;
  generation: symbol;
  version: number;
  lastSaved: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

function saveRequest(
  live: AutosaveLiveState,
  key: string,
  payload: DraftSaveContent,
): AutosaveRequest {
  const { generation, version } = live;
  return { key, payload, generation, version };
}

function cancelDebounce(live: AutosaveLiveState): void {
  if (live.debounceTimer === null) return;
  clearTimeout(live.debounceTimer);
  live.debounceTimer = null;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(live: AutosaveLiveState, sinks: AutosaveSinks): void {
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
  live.mutation.mutate({
    ...queued,
    version: current ? Math.max(live.version, queued.version) : queued.version,
  });
}

function reconcileCurrentSave(
  live: AutosaveLiveState,
  saved: ReportSectionReadModel,
  request: AutosaveRequest,
): string {
  const queued = live.persisted.queuedFor(request.generation);
  const reconciliation = live.args.onSaved?.(
    saved,
    request.payload,
    queued?.payload ?? null,
    request.persistedAttempt?.token,
  );
  if (reconciliation && queued)
    live.persisted.rebaseQueued(
      queued,
      reconciliation.queuedPayload,
      saved.version,
    );
  return reconciliation?.savedKey ?? request.key;
}

function saveSucceeded(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  saved: ReportSectionReadModel,
  request: AutosaveRequest,
): void {
  const { generation } = request;
  if (!live.persisted.canComplete(request)) {
    drainQueuedSave(live, sinks);
    return;
  }
  if (
    generation !== live.generation ||
    saved.reportSectionId !== live.args.reportSectionId ||
    saved.version < live.version
  ) {
    settleDropped(request, "obsolete");
    live.persisted.reconcileObsolete(request, saved, live.generation);
    drainQueuedSave(live, sinks);
    return;
  }
  // Bump version before the drain so a queued save rebases instead of
  // self-409ing on the writer's own previous save.
  live.version = saved.version;
  live.args.onVersionChange(saved.version);

  const savedKey = reconcileCurrentSave(live, saved, request);
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
  const { generation } = request;
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
  sinks.setState("error");
  // A 409 hands off to the conflict flow (refetch): retrying the stale
  // version would just 409 again.
  if (live.args.onConflict && isLeadFormWriteConflict(err)) {
    live.args.onConflict();
    return;
  }
  // Re-arm only if the queued edit still targets the form's current section.
  if (
    queuedSectionId !== null &&
    queuedSectionId === live.args.reportSectionId &&
    !live.persisted.blocked()
  ) {
    sinks.rearmRetry();
  }
  toast.error(autosaveFailureMessage(err));
}

function issueSave(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  request: AutosaveRequest,
): Promise<unknown> {
  if (live.mutation.isPending) {
    live.persisted.replaceQueued(request);
    return Promise.resolve();
  }
  sinks.setState("saving");
  return live.mutation.mutateAsync(request);
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
  const current = live.args.payload;
  const currentKey =
    current === null ? "" : encodeDraftSaveComparisonKey(current);
  const sectionId = live.args.reportSectionId;
  if (
    live.persisted.blocked() ||
    !live.args.enabled ||
    current === null ||
    !sectionId
  ) {
    return;
  }
  // Already up-to-date — nothing to save.
  if (currentKey === live.lastSaved) return;

  cancelDebounce(live);
  try {
    await issueSave(
      live,
      sinks,
      saveRequest(live, currentKey, { ...current, reportSectionId: sectionId }),
    );
  } catch {
    // The mutation's onError already surfaced this failure (toast + error
    // state → Retry); forceSave must not reject the caller's promise on top.
  }
}

function savePersistedNow(
  live: AutosaveLiveState,
  sinks: AutosaveSinks,
  token: string,
): Promise<PersistedSaveResult> {
  cancelDebounce(live);
  const payload = live.args.payload;
  if (
    !live.args.enabled ||
    payload?.reportSectionId.localeCompare(live.args.reportSectionId ?? "") !==
      0
  )
    return Promise.resolve({ status: "obsolete", token });
  const { request, promise } = live.persisted.create(
    saveRequest(live, encodeDraftSaveComparisonKey(payload), payload),
    token,
  );
  void issueSave(live, sinks, request).catch(() => undefined);
  return promise;
}

// The autosave engine: one unit that owns the live holder and exposes only
// intent operations. Every operation is a stable identity.
export function createAutosaveEngine(
  args: UseLeadFormAutosaveArgs,
  sinks: AutosaveSinks,
) {
  const live: AutosaveLiveState = {
    persisted: createPersistedIntentOwner(),
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
    savePersisted: (token: string) => savePersistedNow(live, sinks, token),
    abandonPersisted: (token: string) => {
      if (live.persisted.abandon(token)) sinks.rearmRetry();
    },
    primeBaseline: (savedKey: string) => {
      live.lastSaved = savedKey;
      sinks.setLastSavedKey(savedKey);
    },
    adoptBaseline: (savedKey: string, source: "read" | "write") => {
      cancelDebounce(live);
      live.persisted.adopt();
      live.lastSaved = savedKey;
      live.persisted.dropGeneration(live.generation);
      sinks.setLastSavedKey(savedKey);
      sinks.setState(source === "write" ? "saved" : "idle");
      sinks.setLastSavedAt(source === "write" ? new Date() : null);
    },
    dispose: () => {
      live.persisted.invalidate();
      cancelDebounce(live);
      live.generation = Symbol("unmounted-autosave");
      live.args = { ...live.args, enabled: false };
      live.persisted.takeQueued();
    },
  };
}
