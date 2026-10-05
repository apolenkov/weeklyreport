"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { isLeadFormWriteConflict } from "../lead-form/lead-form-write-port";
import {
  autosaveFailureMessage,
  reportedAutosaveState,
  useBeforeUnloadGuard,
} from "./autosave-effects";
import {
  type AutosaveMutationHandle,
  useSaveDraftMutation,
} from "./autosave-mutation";
import type {
  AutosaveController,
  AutosaveRequest,
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import {
  rebaseQueuedRequest,
  reconcileQueuedRequest,
} from "./lead-form-draft-reconcile";

const DEFAULT_DEBOUNCE_MS = 5000;

// The module's one mutable live-state holder. It never leaves this file:
// sibling autosave modules receive plain values and callbacks, so no file can
// repopulate or read render-owned state through a shared mutable bundle.
interface AutosaveLiveState {
  // Each section activation owns its asynchronous completions, including A→B→A.
  generation: symbol;
  // Live optimistic-lock version, advanced synchronously in onSuccess before
  // the queued drain fires — so a drained save rebases onto the bumped version
  // instead of self-409ing on the writer's own previous save.
  version: number;
  lastSaved: string;
  // The latest queued request retains its own target, activation and version.
  queued: AutosaveRequest | null;
  // Active debounce timer id, so forceSave can cancel it.
  debounceTimer: ReturnType<typeof setTimeout> | null;
  payload: DraftSaveContent | null;
  sectionId: string | null;
  mutate: AutosaveMutationHandle["mutate"];
  mutateAsync: AutosaveMutationHandle["mutateAsync"];
  isPending: boolean;
  enabled: boolean;
}

function seedLiveState(args: UseLeadFormAutosaveArgs): AutosaveLiveState {
  // Pre-bind invocation must fail loud: the stamp effect replaces these
  // handles before any timer or event fires, so a hit here is a
  // wiring/ordering bug.
  const unboundMessage =
    "Autosave mutation invoked before the sync effect bound the live handle";
  return {
    generation: Symbol("autosave-generation"),
    version: args.version,
    lastSaved: "",
    queued: null,
    debounceTimer: null,
    payload: args.payload,
    sectionId: args.reportSectionId,
    mutate: () => {
      throw new Error(unboundMessage);
    },
    mutateAsync: () => Promise.reject(new Error(unboundMessage)),
    isPending: false,
    enabled: args.enabled,
  };
}

function saveRequest(
  live: AutosaveLiveState,
  key: string,
  payload: DraftSaveContent,
): AutosaveRequest {
  return {
    key,
    payload,
    generation: live.generation,
    version: live.version,
  };
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(
  live: AutosaveLiveState,
  setState: Dispatch<SetStateAction<AutosaveState>>,
): void {
  const queued = live.queued;
  live.queued = null;
  if (queued === null) return;
  const current = queued.generation === live.generation;
  if (current && (!live.enabled || queued.key === live.lastSaved)) return;
  if (current) setState("saving");
  live.mutate({
    ...queued,
    version: current ? Math.max(live.version, queued.version) : queued.version,
  });
}

// TODO(TASK-308): the hook exceeds max-lines-per-function (suppressed in
// eslint-suppressions.json) because lead-form-draft-module keeps AutosaveLiveState
// in this file and the file is at its max-lines limit; relax that requirement or
// slim the hook.
export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveController {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [queuedRetryRevision, setQueuedRetryRevision] = useState(0);
  // Mirrors live.current.lastSaved so render computes `dirty` from state,
  // never by touching the holder during render. Both are written together on
  // save and baseline adoption.
  const [lastSavedKey, setLastSavedKey] = useState("");
  const live = useRef<AutosaveLiveState>(seedLiveState(args));
  const { enabled, onConflict, onSaved, onVersionChange, reportSectionId } =
    args;

  const handleSaveSuccess = useCallback(
    (saved: ReportSectionReadModel, request: AutosaveRequest) => {
      const l = live.current;
      const { payload, generation } = request;
      if (
        generation !== l.generation ||
        saved.reportSectionId !== l.sectionId ||
        saved.version < l.version
      ) {
        if (generation !== l.generation) {
          const reconciled = reconcileQueuedRequest(
            l.queued,
            generation,
            saved,
            payload,
          );
          if (reconciled !== null) l.queued = reconciled;
        }
        drainQueuedSave(l, setAutosaveState);
        return;
      }
      // Bump version before the drain so a queued save rebases instead of
      // self-409ing on the writer's own previous save.
      l.version = saved.version;
      onVersionChange(saved.version);

      const queued = l.queued?.generation === generation ? l.queued : null;
      const reconciliation = onSaved?.(saved, payload, queued?.payload ?? null);
      if (reconciliation && queued) {
        l.queued = rebaseQueuedRequest(
          queued,
          reconciliation.queuedPayload,
          saved.version,
        );
      }
      const savedKey = reconciliation?.savedKey ?? request.key;
      l.lastSaved = savedKey;
      setLastSavedKey(savedKey);
      setAutosaveState("saved");
      setLastSavedAt(new Date());
      drainQueuedSave(l, setAutosaveState);
    },
    [onSaved, onVersionChange],
  );
  const handleSaveError = useCallback(
    (err: unknown, generation: symbol) => {
      const l = live.current;
      if (generation !== l.generation) {
        if (l.queued?.generation === generation) l.queued = null;
        drainQueuedSave(l, setAutosaveState);
        return;
      }
      const queuedSectionId = l.queued?.payload.reportSectionId ?? null;
      l.queued = null;
      setAutosaveState("error");
      // A 409 hands off to the conflict flow (refetch): retrying the stale
      // version would just 409 again.
      if (onConflict && isLeadFormWriteConflict(err)) {
        onConflict();
        return;
      }
      // Re-arm only if the queued edit still targets the form's current
      // section (the render-time prop, not the live one).
      if (queuedSectionId !== null && queuedSectionId === reportSectionId) {
        setQueuedRetryRevision((revision) => revision + 1);
      }
      toast.error(autosaveFailureMessage(err));
    },
    [onConflict, reportSectionId],
  );
  const saveDraft = useSaveDraftMutation({
    writePort: args.writePort,
    onSuccess: handleSaveSuccess,
    onError: handleSaveError,
  });

  // No dep array on purpose: every commit must re-stamp the live values.
  useEffect(() => {
    const l = live.current;
    if (l.sectionId !== args.reportSectionId) {
      l.generation = Symbol("autosave-generation");
    }
    l.payload = args.payload;
    l.sectionId = args.reportSectionId;
    l.enabled = args.enabled;
    l.mutate = saveDraft.mutate;
    l.mutateAsync = saveDraft.mutateAsync;
    l.isPending = saveDraft.isPending;
    // Re-sync the live version from the prop (e.g. a reseed after fillFrom or
    // a conflict refetch). A successful save's onSuccess advances it ahead of
    // this in the same tick; the prop catches up on the next render.
    l.version = args.version;
  });
  useEffect(
    () => () => {
      const l = live.current;
      l.generation = Symbol("unmounted-autosave");
      l.enabled = false;
      l.queued = null;
    },
    [live],
  );

  // Lets the LeadForm say "this freshly-loaded server payload is already
  // saved", so the user does not see a dirty state on initial render.
  const initialSavedKey = args.initialSavedKey ?? null;
  useEffect(() => {
    if (initialSavedKey === null) return;
    live.current.lastSaved = initialSavedKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the prop-provided baseline key into its render-visible twin; both writes must stay atomic in one effect.
    setLastSavedKey(initialSavedKey);
  }, [initialSavedKey]);

  const payloadKey =
    args.payload === null ? "" : encodeDraftSaveComparisonKey(args.payload);
  const hasPayload = args.payload !== null && payloadKey !== "";
  const currentPayloadMatchesSavedBaseline =
    hasPayload && payloadKey === lastSavedKey;
  const dirty =
    args.enabled && hasPayload && !currentPayloadMatchesSavedBaseline;

  const debounceMs = args.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const armed = enabled && dirty && Boolean(reportSectionId);
  const state = reportedAutosaveState(
    autosaveState,
    armed,
    !dirty && lastSavedKey === payloadKey,
  );

  // Every effect dep must be a primitive or a stable identity — never the args
  // object — or an unrelated re-render restarts the timer and stretches the
  // debounce window indefinitely.
  useEffect(() => {
    if (!enabled || !dirty || !reportSectionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the debounce arm IS the pending announcement: it must fire exactly once per dep change, which is effect-owned timer choreography.
    setAutosaveState("pending");
    const timer = setTimeout(() => {
      // When a save is already in flight the payload is stashed for the
      // onSuccess drain instead of starting a second parallel mutation on the
      // single in-flight slot (mirrors forceSave's guard); otherwise the save
      // starts with the live version injected.
      const l = live.current;
      const current = l.payload;
      if (current === null) return;
      if (l.isPending) {
        l.queued = saveRequest(l, payloadKey, current);
        return;
      }
      setAutosaveState("saving");
      l.mutate(saveRequest(l, payloadKey, { ...current, reportSectionId }));
    }, debounceMs);

    const l = live.current;
    l.debounceTimer = timer;
    return () => {
      clearTimeout(timer);
      if (l.debounceTimer === timer) l.debounceTimer = null;
    };
  }, [
    payloadKey,
    enabled,
    dirty,
    reportSectionId,
    debounceMs,
    queuedRetryRevision,
  ]);

  // A partially typed row is unsaved user content even though it cannot change
  // the payload yet, so leaving the page still warns about it.
  useBeforeUnloadGuard(dirty || (args.localOnlyRows ?? 0) > 0);

  // Cancels the pending debounce timer and triggers an immediate save. If a
  // mutation is already in flight the current payload is queued and fired
  // automatically on success.
  const forceSave = useCallback(async () => {
    const l = live.current;
    const current = l.payload;
    const currentKey =
      current === null ? "" : encodeDraftSaveComparisonKey(current);
    const sectionId = l.sectionId;
    if (!l.enabled || current === null || currentKey === "" || !sectionId) {
      return;
    }
    // Already up-to-date — nothing to save.
    if (currentKey === l.lastSaved) return;

    if (l.debounceTimer !== null) {
      clearTimeout(l.debounceTimer);
      l.debounceTimer = null;
    }
    if (l.isPending) {
      l.queued = saveRequest(l, currentKey, current);
      return;
    }
    setAutosaveState("saving");
    try {
      await l.mutateAsync(
        saveRequest(l, currentKey, { ...current, reportSectionId: sectionId }),
      );
    } catch {
      // The mutation's onError already surfaced this failure (toast + error
      // state → Retry); forceSave must not reject the caller's promise on top.
    }
  }, []);

  const primeBaseline = useCallback((savedKey: string) => {
    live.current.lastSaved = savedKey;
    setLastSavedKey(savedKey);
  }, []);
  const adoptBaseline = useCallback(
    (savedKey: string, source: "read" | "write") => {
      const l = live.current;
      if (l.debounceTimer !== null) {
        clearTimeout(l.debounceTimer);
        l.debounceTimer = null;
      }
      l.lastSaved = savedKey;
      if (l.queued?.generation === l.generation) l.queued = null;
      setLastSavedKey(savedKey);
      setAutosaveState(source === "write" ? "saved" : "idle");
      setLastSavedAt(source === "write" ? new Date() : null);
    },
    [],
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
