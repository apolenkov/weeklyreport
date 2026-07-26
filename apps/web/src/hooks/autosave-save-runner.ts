import type { Dispatch, SetStateAction } from "react";

import type { GetAutosaveRefs } from "./autosave-refs";
import { stableStringify } from "./autosave-stable-stringify";
import type { AutosaveState } from "./autosave-types";

export interface DebounceSaveDeps {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly payloadKey: string;
  readonly reportSectionId: string;
}

// Fired by the debounce timer. When a save is already in flight the payload is
// stashed for the onSuccess drain instead of starting a second parallel
// mutation on the single in-flight slot (mirrors forceSave's guard); otherwise
// it starts the save with the live version injected.
export function runDebouncedSaveTick(deps: DebounceSaveDeps): void {
  const refs = deps.getRefs();
  const current = refs.payload;
  if (current === null) return;
  if (refs.isPending) {
    refs.queuedKey = deps.payloadKey;
    refs.queuedPayload = current;
    return;
  }
  deps.setState("saving");
  refs.inFlight = deps.payloadKey;
  refs.inFlightPayload = current;
  refs.inFlightSection = deps.reportSectionId;
  refs.mutate({
    ...current,
    reportSectionId: deps.reportSectionId,
    version: refs.version,
  });
}

export interface ForceSaveDeps {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
}

// Cancels the pending debounce timer and triggers an immediate save. If a
// mutation is already in flight the current payload is queued and fired
// automatically on success.
export async function runForceSave(deps: ForceSaveDeps): Promise<void> {
  const refs = deps.getRefs();
  const current = refs.payload;
  const currentKey = current === null ? "" : stableStringify(current);
  const sectionId = refs.sectionId;

  if (!refs.enabled || current === null || currentKey === "" || !sectionId) {
    return;
  }
  // Already up-to-date — nothing to save.
  if (currentKey === refs.lastSaved) return;

  if (refs.debounceTimer !== null) {
    clearTimeout(refs.debounceTimer);
    refs.debounceTimer = null;
  }

  if (refs.isPending) {
    // A mutation is already in flight. Queue for after success.
    refs.queuedKey = currentKey;
    refs.queuedPayload = current;
    return;
  }

  deps.setState("saving");
  refs.inFlight = currentKey;
  refs.inFlightPayload = current;
  refs.inFlightSection = sectionId;
  await refs.mutateAsync({
    ...current,
    reportSectionId: sectionId,
    version: refs.version,
  });
}
