import type { ReportSectionReadModel } from "@customreport/shared";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type {
  AutosaveRequest,
  PersistedSaveAttempt,
  PersistedSaveResult,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  rebaseQueuedRequest,
  reconcileQueuedRequest,
  reconcileSavedPayloadIdentities,
} from "./lead-form-draft-reconcile";

export function settleDropped(
  request: AutosaveRequest | null,
  status: "superseded" | "obsolete",
): void {
  request?.persistedAttempt?.settle({
    status,
    token: request.persistedAttempt.token,
  });
}

function settlePersistedSuccess(
  request: AutosaveRequest,
  saved: ReportSectionReadModel,
): boolean | null {
  const attempt = request.persistedAttempt;
  if (!attempt) return null;
  const savedPayload = sectionToDraftPayload(saved);
  const expected = reconcileSavedPayloadIdentities(
    request.payload,
    savedPayload,
    request.payload,
  );
  const accepted =
    saved.reportSectionId === request.payload.reportSectionId &&
    saved.version > request.version &&
    encodeDraftSaveComparisonKey(expected) ===
      encodeDraftSaveComparisonKey(savedPayload);
  attempt.settle(
    accepted
      ? {
          status: "accepted",
          token: attempt.token,
          payload: savedPayload,
          reportSectionId: saved.reportSectionId,
          version: saved.version,
        }
      : { status: "failed", token: attempt.token },
  );
  return accepted;
}

function settleAll(
  active: Set<PersistedSaveAttempt>,
  status: "obsolete" | "superseded",
): void {
  for (const attempt of active)
    attempt.settle({ status, token: attempt.token });
}

// Only this engine activation's explicit persisted attempts, never transport or
// render state. Callers receive operations rather than the mutable registry.
export function createPersistedIntentOwner() {
  const active = new Set<PersistedSaveAttempt>();
  const queued: { request: AutosaveRequest | null } = { request: null };
  const replaceQueued = (next: AutosaveRequest | null) => {
    if (queued.request?.persistedAttempt !== next?.persistedAttempt)
      settleDropped(queued.request, "superseded");
    queued.request = next;
  };
  const barrier: { token: string | null } = { token: null };
  return {
    queued: () => queued.request,
    queuedFor: (generation: symbol) =>
      queued.request?.generation === generation ? queued.request : null,
    replaceQueued,
    takeQueued: () => {
      const request = queued.request;
      queued.request = null;
      return request;
    },
    dropGeneration: (generation: symbol) => {
      if (queued.request?.generation === generation) replaceQueued(null);
    },
    rebaseQueued: (
      request: AutosaveRequest,
      payload: import("./autosave-types").DraftSaveContent | null,
      version: number,
    ) => replaceQueued(rebaseQueuedRequest(request, payload, version)),
    reconcileObsolete: (
      request: AutosaveRequest,
      saved: ReportSectionReadModel,
      generation: symbol,
    ) => {
      if (request.generation === generation) return;
      const reconciled = reconcileQueuedRequest(
        queued.request,
        request.generation,
        saved,
        request.payload,
      );
      if (reconciled) replaceQueued(reconciled);
    },
    blocked: () => barrier.token !== null,
    canComplete: (request: AutosaveRequest) =>
      !request.persistedAttempt || active.has(request.persistedAttempt),
    create: (request: AutosaveRequest, token: string) => {
      barrier.token = token;
      const deferred = Promise.withResolvers<PersistedSaveResult>();
      const attempt: PersistedSaveAttempt = {
        token,
        settle: (result) => {
          if (active.delete(attempt)) deferred.resolve(result);
        },
      };
      active.add(attempt);
      return {
        request: { ...request, persistedAttempt: attempt },
        promise: deferred.promise,
      };
    },
    accept: (request: AutosaveRequest, saved: ReportSectionReadModel) => {
      const accepted = settlePersistedSuccess(request, saved);
      const token = request.persistedAttempt?.token;
      if (accepted && token && barrier.token?.localeCompare(token) === 0)
        barrier.token = null;
      return accepted;
    },
    abandon: (token: string) => {
      if (barrier.token !== token) return false;
      barrier.token = null;
      return true;
    },
    adopt: () => settleAll(active, "superseded"),
    invalidate: () => {
      settleAll(active, "obsolete");
      barrier.token = null;
      if (queued.request?.persistedAttempt) replaceQueued(null);
    },
  };
}
