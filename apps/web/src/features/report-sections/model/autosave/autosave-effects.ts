"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";

import type { GetAutosaveRefs } from "./autosave-refs";
import { runDebouncedSaveTick } from "./autosave-save-runner";
import type { AutosaveState, UseLeadFormAutosaveArgs } from "./autosave-types";

const DEFAULT_DEBOUNCE_MS = 5000;

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
