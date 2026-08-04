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
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type {
  AutosaveSnapshot,
  AutosaveState,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

export { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
export type {
  AutosaveSnapshot,
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveSnapshot {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedRetryRevision, setQueuedRetryRevision] = useState(0);
  // Mirrors refs.current.lastSaved so render computes `dirty` from state, never
  // by touching the ref during render. Both are written together on save/baseline.
  const [lastSavedKey, setLastSavedKey] = useState("");

  const [refs] = useState<AutosaveRefs>(() => seedAutosaveRefs(args));
  // Stable accessor: effects can list it as a dep without restarting, and a
  // callee can only resolve the bundle at event or effect time, never at render.
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
    args.payload === null ? "" : encodeAutosaveComparisonKey(args.payload);
  const dirty =
    args.enabled &&
    args.payload !== null &&
    payloadKey !== "" &&
    payloadKey !== lastSavedKey;

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

  return {
    state,
    lastSavedAt,
    dirty,
    isInFlight: saveDraft.isPending,
    forceSave,
  };
}
