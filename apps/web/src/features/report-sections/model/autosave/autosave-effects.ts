"use client";

import { useEffect } from "react";

import type { AutosaveState } from "./autosave-types";

// A pending announcement whose edit is no longer dirty is stale (first render
// races the baseline-priming effect; undo restores saved content). Undoing a
// failed change to the confirmed baseline clears its error. Derived so the
// debounce effect never needs a synchronous setState for the reset.
export function reportedAutosaveState(
  current: AutosaveState,
  armed: boolean,
  failedBaselineRestored: boolean,
): AutosaveState {
  if (armed) return current;
  if (current === "pending") return "idle";
  if (current === "error" && failedBaselineRestored) return "idle";
  return current;
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
