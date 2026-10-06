"use client";

import { useEffect, useState } from "react";

import {
  reportedAutosaveState,
  useBeforeUnloadGuard,
} from "./autosave-effects";
import { createAutosaveEngine } from "./autosave-live-state";
import { useSaveDraftMutation } from "./autosave-mutation";
import type {
  AutosaveController,
  AutosaveState,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

const DEFAULT_DEBOUNCE_MS = 5000;

// Thin React wiring: render-visible state lives here, every mutable
// live value and save rule lives behind the engine's operations.
export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveController {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedRetryRevision, setQueuedRetryRevision] = useState(0);
  // Mirrors the engine's saved baseline so render computes `dirty` from
  // state, never by reading the engine during render.
  const [lastSavedKey, setLastSavedKey] = useState("");
  const [engine] = useState(() =>
    createAutosaveEngine(args, {
      setState: setAutosaveState,
      setLastSavedAt,
      setLastSavedKey,
      rearmRetry: () => setQueuedRetryRevision((revision) => revision + 1),
    }),
  );
  const { enabled, reportSectionId, initialSavedKey = null } = args;
  const saveDraft = useSaveDraftMutation({
    writePort: args.writePort,
    onSuccess: engine.onSaveSuccess,
    onError: engine.onSaveError,
  });

  // No dep array on purpose: every commit must re-stamp the live values.
  useEffect(() => {
    engine.stamp(args, saveDraft);
  });
  useEffect(() => engine.dispose, [engine]);

  // Lets the LeadForm say "this freshly-loaded server payload is already
  // saved", so the user does not see a dirty state on initial render.
  useEffect(() => {
    if (initialSavedKey !== null) engine.primeBaseline(initialSavedKey);
  }, [engine, initialSavedKey]);

  const payloadKey =
    args.payload === null ? "" : encodeDraftSaveComparisonKey(args.payload);
  const hasPayload = args.payload !== null && payloadKey !== "";
  const currentPayloadMatchesSavedBaseline =
    hasPayload && payloadKey === lastSavedKey;
  const dirty = enabled && hasPayload && !currentPayloadMatchesSavedBaseline;
  const debounceMs = args.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const armed = dirty && Boolean(reportSectionId);
  const state = reportedAutosaveState(
    autosaveState,
    armed,
    !dirty && lastSavedKey === payloadKey,
  );

  // Every effect dep must be a primitive or a stable identity — never the args
  // object — or an unrelated re-render restarts the timer and stretches the
  // debounce window indefinitely.
  useEffect(() => {
    if (!dirty || !reportSectionId) return;
    return engine.armDebounce(payloadKey, reportSectionId, debounceMs);
  }, [
    engine,
    payloadKey,
    dirty,
    reportSectionId,
    debounceMs,
    queuedRetryRevision,
  ]);

  // A partially typed row is unsaved user content even though it cannot change
  // the payload yet, so leaving the page still warns about it.
  useBeforeUnloadGuard(dirty || (args.localOnlyRows ?? 0) > 0);

  return {
    state,
    lastSavedAt,
    dirty,
    currentPayloadMatchesSavedBaseline,
    isInFlight: saveDraft.isPending,
    forceSave: engine.forceSave,
    primeBaseline: engine.primeBaseline,
    adoptBaseline: engine.adoptBaseline,
  };
}
