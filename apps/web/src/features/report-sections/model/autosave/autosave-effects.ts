"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { mutationErrorMessage } from "../../../../shared/lib/errors/mutation-error-message";
import { isLeadFormWriteConflict } from "../lead-form/lead-form-write-port";
import type { AutosaveState } from "./autosave-types";
import type {
  AutosaveRequest,
  AutosaveSinks,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

export function reportSaveFailure(
  error: unknown,
  options: {
    args: UseLeadFormAutosaveArgs;
    sinks: AutosaveSinks;
    contextual: boolean;
    retry: boolean;
    request: AutosaveRequest;
  },
): void {
  options.sinks.setState("error");
  if (options.args.onConflict && isLeadFormWriteConflict(error)) {
    options.args.onConflict(options.contextual, options.request);
    return;
  }
  if (options.retry) options.sinks.rearmRetry();
  toast.error(autosaveFailureMessage(error));
}

// The frozen original request is reconciled against a fresh authoritative
// read on conflict, never replayed.
export function reportOwnedFailure(
  args: UseLeadFormAutosaveArgs,
  sinks: AutosaveSinks,
  error: unknown,
): void {
  sinks.setState("error");
  if (isLeadFormWriteConflict(error)) args.onConflict?.(true);
}

export function armSaveTimer(callback: () => void, delay: number) {
  const timer = setTimeout(callback, delay);
  return { timer, cancel: () => clearTimeout(timer) };
}

const AUTOSAVE_FAILURE_MESSAGE =
  "Autosave failed. Check your connection and use Save to retry.";

// A bare browser transport message ("Failed to fetch") is not actionable.
function autosaveFailureMessage(error: unknown): string {
  return (
    mutationErrorMessage(error, AUTOSAVE_FAILURE_MESSAGE) ||
    AUTOSAVE_FAILURE_MESSAGE
  );
}

// A pending announcement whose edit is no longer dirty is stale (first render
// races the baseline-priming effect; undo restores saved content). Undoing a
// failed change to the confirmed baseline clears its error. Derived so the
// debounce effect never needs a synchronous setState for the reset.
function reportedAutosaveState(
  current: AutosaveState,
  armed: boolean,
  failedBaselineRestored: boolean,
): AutosaveState {
  if (armed) return current;
  if (current === "pending") return "idle";
  if (current === "error" && failedBaselineRestored) return "idle";
  return current;
}

// Render-visible save status of the current draft. A draft equal to the held
// conflict key is unsaved and waits for the Lead, so it reports an error and
// never arms the debounce.
export function autosaveDraftView(view: {
  readonly payload: DraftSaveContent | null;
  readonly heldKey: string | null;
  readonly lastSavedKey: string;
  readonly enabled: boolean;
  readonly reportSectionId: string | null;
  readonly autosaveState: AutosaveState;
}) {
  const payloadKey =
    view.payload === null ? "" : encodeDraftSaveComparisonKey(view.payload);
  const hasPayload = payloadKey !== "";
  const currentPayloadMatchesSavedBaseline =
    hasPayload && payloadKey === view.lastSavedKey;
  const dirty =
    view.enabled && hasPayload && !currentPayloadMatchesSavedBaseline;
  const held = dirty && payloadKey === view.heldKey;
  const armed = dirty && !held && Boolean(view.reportSectionId);
  const state: AutosaveState = held
    ? "error"
    : reportedAutosaveState(
        view.autosaveState,
        armed,
        !dirty && view.lastSavedKey === payloadKey,
      );
  return {
    payloadKey,
    currentPayloadMatchesSavedBaseline,
    dirty,
    armed,
    state,
  };
}

export function useBeforeUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler: EventListener = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
