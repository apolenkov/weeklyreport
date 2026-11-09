import { LeadFormWriteError } from "../lead-form/lead-form-write-port";
import type { AutosaveRecovery, AutosaveRequest } from "./autosave-types";

function freezePayload(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) freezePayload(child);
  Object.freeze(value);
}

export function captureAutosaveRequest(
  request: AutosaveRequest,
): AutosaveRequest {
  const payload = structuredClone(request.payload);
  freezePayload(payload);
  return Object.freeze({ ...request, payload });
}

// One explicit whole-section operation owns all exact-version competitors.
// An error is evidence, not settlement: a different response may still succeed.
export function createSaveRecovery(
  publish: (state: AutosaveRecovery | null) => void,
) {
  const state: {
    original: AutosaveRequest | null;
    phase: AutosaveRecovery["phase"];
    pending: number;
  } = {
    original: null,
    phase: "pending",
    pending: 0,
  };
  const notify = () => {
    const { original, phase, pending } = state;
    if (!original?.persistedAttempt) return;
    publish({
      token: original.persistedAttempt.token,
      reportSectionId: original.payload.reportSectionId,
      expectedVersion: original.version,
      phase,
      pendingTransports: pending,
    });
  };
  const owns = (request: AutosaveRequest) =>
    state.original !== null &&
    request.persistedAttempt === state.original.persistedAttempt;
  return {
    blocked: () => state.original !== null,
    owns,
    start: (request: AutosaveRequest) => {
      if (!request.persistedAttempt) return;
      state.original = captureAutosaveRequest(request);
      state.phase = "pending";
      state.pending = 1;
      notify();
    },
    retry: (token: string) => {
      const { original, phase, pending } = state;
      if (
        !original ||
        original.persistedAttempt?.token !== token ||
        phase === "reconciliation" ||
        pending > 1
      )
        return null;
      state.pending += 1;
      notify();
      return original;
    },
    fail: (request: AutosaveRequest, error: unknown) => {
      if (!owns(request)) return false;
      state.pending = Math.max(0, state.pending - 1);
      // The legacy typed "error" has no reliable delivery semantics. Fail
      // closed until the adapter can distinguish an ambiguous transport result.
      if (error instanceof LeadFormWriteError && error.kind !== "ambiguous")
        state.phase = "reconciliation";
      else if (state.phase !== "reconciliation") state.phase = "ambiguous";
      notify();
      return true;
    },
    mismatch: (request: AutosaveRequest) => {
      if (!owns(request)) return;
      state.pending = Math.max(0, state.pending - 1);
      state.phase = "reconciliation";
      notify();
    },
    clear: () => {
      state.original = null;
      state.pending = 0;
      publish(null);
    },
  };
}
