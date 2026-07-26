"use client";

import { useCallback, useRef, useState } from "react";

import { useBeforeUnloadGuard, useDebouncedSave } from "./autosave-effects";
import { useSaveDraftMutation } from "./autosave-mutation";
import {
  type AutosaveRefs,
  seedAutosaveRefs,
  usePrimedBaseline,
  useSyncAutosaveRefs,
} from "./autosave-refs";
import { runForceSave } from "./autosave-save-runner";
import { stableStringify } from "./autosave-stable-stringify";
import type {
  AutosaveSnapshot,
  AutosaveState,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";

export { stableStringify } from "./autosave-stable-stringify";
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

  const refs = useRef<AutosaveRefs>(seedAutosaveRefs(args));
  // Stable accessor: effects can list it as a dep without restarting, and a
  // callee can only resolve the bundle at event or effect time, never at render.
  const getRefs = useCallback(() => refs.current, []);

  const saveDraft = useSaveDraftMutation({
    getRefs,
    setState,
    setLastSavedAt,
    setQueuedRetryRevision,
    args,
  });
  useSyncAutosaveRefs(getRefs, args, saveDraft);
  usePrimedBaseline(getRefs, args.initialSavedKey ?? null);

  const payloadKey = args.payload === null ? "" : stableStringify(args.payload);
  const dirty =
    args.enabled &&
    args.payload !== null &&
    payloadKey !== "" &&
    // eslint-disable-next-line react-hooks/refs -- dirty is deliberately computed from the last-saved ref at render; making it state would re-arm the debounce on every save
    payloadKey !== refs.current.lastSaved;

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
