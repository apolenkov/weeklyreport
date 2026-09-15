"use client";

import { useCallback, useState } from "react";

import { useBeforeUnloadGuard, useDebouncedSave } from "./autosave-effects";
import { useSaveDraftMutation } from "./autosave-mutation";
import {
  type AutosaveRefs,
  seedAutosaveRefs,
  usePrimedBaseline,
  useSyncAutosaveRefs,
} from "./autosave-refs";
import { runForceSave } from "./autosave-save-runner";
import type {
  AutosaveController,
  AutosaveState,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";

export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveController {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedRetryRevision, setQueuedRetryRevision] = useState(0);
  // Mirrors refs.current.lastSaved so render computes `dirty` from state, never
  // by touching the ref during render. Both are written together on save/baseline.
  const [lastSavedKey, setLastSavedKey] = useState("");

  const [refs] = useState<AutosaveRefs>(() => seedAutosaveRefs(args));
  // Stable accessor keeps effect dependencies stable while the sync hook
  // updates the mutable bundle with the latest inputs.
  const getRefs = useCallback(() => refs, [refs]);

  const saveDraft = useSaveDraftMutation({
    getRefs,
    setState,
    setLastSavedAt,
    setLastSavedKey,
    setQueuedRetryRevision,
    args,
  });
  useSyncAutosaveRefs(getRefs, args, saveDraft);
  usePrimedBaseline(getRefs, args.initialSavedKey ?? null, setLastSavedKey);

  const payloadKey =
    args.payload === null ? "" : encodeDraftSaveComparisonKey(args.payload);
  const hasPayload = args.payload !== null && payloadKey !== "";
  const currentPayloadMatchesSavedBaseline =
    hasPayload && payloadKey === lastSavedKey;
  const dirty =
    args.enabled && hasPayload && !currentPayloadMatchesSavedBaseline;

  useDebouncedSave({
    getRefs,
    setState,
    args,
    payloadKey,
    dirty,
    queuedRetryRevision,
  });
  useBeforeUnloadGuard(dirty);

  const forceSave = useCallback(
    () => runForceSave({ getRefs, setState }),
    [getRefs, setState],
  );

  const primeBaseline = useCallback(
    (savedKey: string) => {
      getRefs().lastSaved = savedKey;
      setLastSavedKey(savedKey);
    },
    [getRefs],
  );
  const adoptBaseline = useCallback(
    (savedKey: string, source: "read" | "write") => {
      const live = getRefs();
      if (live.debounceTimer !== null) {
        clearTimeout(live.debounceTimer);
        live.debounceTimer = null;
      }
      live.lastSaved = savedKey;
      if (live.queued?.generation === live.generation) live.queued = null;
      setLastSavedKey(savedKey);
      setState(source === "write" ? "saved" : "idle");
      setLastSavedAt(source === "write" ? new Date() : null);
    },
    [getRefs],
  );

  return {
    state,
    lastSavedAt,
    dirty,
    currentPayloadMatchesSavedBaseline,
    isInFlight: saveDraft.isPending,
    forceSave,
    primeBaseline,
    adoptBaseline,
  };
}
