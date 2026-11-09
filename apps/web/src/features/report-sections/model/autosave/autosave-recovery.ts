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

interface RecoveryState {
  original: AutosaveRequest | null;
  phase: AutosaveRecovery["phase"];
  pending: number;
  dispatched: number;
  conflicts: number;
}

// Only when every dispatched copy answered a stale-version conflict is it
// proven that nothing of the original was applied and nothing is in flight.
function provenUnapplied(state: RecoveryState, token: string): boolean {
  return (
    state.original?.persistedAttempt?.token === token &&
    state.pending === 0 &&
    state.conflicts === state.dispatched
  );
}

function idleRecoveryState(): RecoveryState {
  return {
    original: null,
    phase: "pending",
    pending: 0,
    dispatched: 0,
    conflicts: 0,
  };
}

// One explicit whole-section operation owns all exact-version competitors.
// An error is evidence, not settlement: a different response may still succeed.
export function createSaveRecovery(
  publish: (state: AutosaveRecovery | null) => void,
) {
  const state = idleRecoveryState();
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
      state.dispatched = 1;
      state.conflicts = 0;
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
      state.dispatched += 1;
      notify();
      return original;
    },
    fail: (request: AutosaveRequest, error: unknown) => {
      if (!owns(request)) return false;
      state.pending = Math.max(0, state.pending - 1);
      // The legacy typed "error" has no reliable delivery semantics. Fail
      // closed until the adapter can distinguish an ambiguous transport result.
      if (error instanceof LeadFormWriteError && error.kind === "conflict")
        state.conflicts += 1;
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
    // The Lead dismissing a proven-unapplied original releases the barrier.
    admitsAbandon: (token: string) => {
      if (state.original === null) return true;
      if (!provenUnapplied(state, token)) return false;
      state.original = null;
      publish(null);
      return true;
    },
  };
}
