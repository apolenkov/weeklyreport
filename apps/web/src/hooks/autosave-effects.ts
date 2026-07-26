"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";

import type { GetAutosaveRefs } from "./autosave-refs";
import { runDebouncedSaveTick } from "./autosave-save-runner";
import type { AutosaveState, UseLeadFormAutosaveArgs } from "./autosave-types";

const DEFAULT_DEBOUNCE_MS = 5000;

// Warns on unsaved edits. Legacy browsers (Chrome <119, Firefox <109) require
// returnValue; modern ones honour preventDefault() alone. Both are kept to
// cover the supported browser matrix.
export function useBeforeUnloadGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-browser compat; returnValue needed for Chrome <119 / Firefox <109; preventDefault() alone is insufficient there
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

export interface DebouncedSaveArgs {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly args: UseLeadFormAutosaveArgs;
  readonly payloadKey: string;
  readonly dirty: boolean;
  readonly queuedRetryRevision: number;
}

// Every effect dep must be a primitive or a stable identity — never the args
// object — or an unrelated re-render restarts the timer and stretches the
// debounce window indefinitely.
export function useDebouncedSave(deps: DebouncedSaveArgs): void {
  const { getRefs, setState, payloadKey, dirty, queuedRetryRevision } = deps;
  const { enabled, reportSectionId } = deps.args;
  const debounceMs = deps.args.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  useEffect(() => {
    if (!enabled || !dirty || !reportSectionId) {
      // A pending announcement whose edit is no longer dirty is stale (first
      // render races the baseline-priming effect; undo restores saved content).
      // Only pending→idle is ours — the mutation callbacks own the rest.
      setState((current) => (current === "pending" ? "idle" : current));
      return;
    }

    setState("pending");
    const timer = setTimeout(() => {
      runDebouncedSaveTick({ getRefs, setState, payloadKey, reportSectionId });
    }, debounceMs);

    getRefs().debounceTimer = timer;
    return () => {
      clearTimeout(timer);
      const refs = getRefs();
      if (refs.debounceTimer === timer) {
        refs.debounceTimer = null;
      }
    };
  }, [
    payloadKey,
    enabled,
    dirty,
    reportSectionId,
    debounceMs,
    queuedRetryRevision,
    getRefs,
    setState,
  ]);
}
