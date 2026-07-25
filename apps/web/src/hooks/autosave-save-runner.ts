import type { DraftSavePayload } from "@customreport/shared";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { stableStringify } from "./autosave-stable-stringify";
import type { AutosaveState, DraftSaveContent } from "./autosave-types";

export interface DebounceSaveDeps {
  readonly payloadRef: RefObject<DraftSaveContent | null>;
  readonly isPendingRef: RefObject<boolean>;
  readonly queuedKeyRef: RefObject<string | null>;
  readonly queuedPayloadRef: RefObject<DraftSaveContent | null>;
  readonly inFlightRef: RefObject<string>;
  readonly inFlightPayloadRef: RefObject<DraftSaveContent | null>;
  readonly inFlightSectionRef: RefObject<string | null>;
  readonly versionRef: RefObject<number>;
  readonly getMutate: () => (payload: DraftSavePayload) => void;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly payloadKey: string;
  readonly reportSectionId: string;
}

/**
 * Fired by the debounce timer. When a save is already in flight the payload is
 * stashed for the onSuccess drain instead of starting a second parallel
 * mutation on the single in-flight slot (mirrors forceSave's guard); otherwise
 * it starts the save with the live version injected.
  * @param deps - The deps argument.
 */
export function runDebouncedSaveTick(deps: DebounceSaveDeps): void {
  const current = deps.payloadRef.current;
  if (current === null) return;
  if (deps.isPendingRef.current) {
    deps.queuedKeyRef.current = deps.payloadKey;
    deps.queuedPayloadRef.current = current;
    return;
  }
  deps.setState("saving");
  deps.inFlightRef.current = deps.payloadKey;
  deps.inFlightPayloadRef.current = current;
  deps.inFlightSectionRef.current = deps.reportSectionId;
  deps.getMutate()({
    ...current,
    reportSectionId: deps.reportSectionId,
    version: deps.versionRef.current,
  });
}

export interface ForceSaveDeps {
  readonly payloadRef: RefObject<DraftSaveContent | null>;
  readonly reportSectionIdRef: RefObject<string | null>;
  readonly lastSavedRef: RefObject<string>;
  readonly debounceTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  readonly queuedKeyRef: RefObject<string | null>;
  readonly queuedPayloadRef: RefObject<DraftSaveContent | null>;
  readonly inFlightRef: RefObject<string>;
  readonly inFlightPayloadRef: RefObject<DraftSaveContent | null>;
  readonly inFlightSectionRef: RefObject<string | null>;
  readonly versionRef: RefObject<number>;
  readonly getMutateAsync: () => (
    payload: DraftSavePayload,
  ) => Promise<unknown>;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly enabled: boolean;
  readonly isPending: boolean;
}

/**
 * Cancels the pending debounce timer and triggers an immediate save. If a
 * mutation is already in flight the current payload is queued and fired
 * automatically on success.
  * @param deps - The deps argument.
 */
export async function runForceSave(deps: ForceSaveDeps): Promise<void> {
  const current = deps.payloadRef.current;
  const currentKey = current === null ? "" : stableStringify(current);
  const sectionId = deps.reportSectionIdRef.current;

  if (!deps.enabled || current === null || currentKey === "" || !sectionId) {
    return;
  }
  // Already up-to-date — nothing to save.
  if (currentKey === deps.lastSavedRef.current) return;

  if (deps.debounceTimerRef.current !== null) {
    clearTimeout(deps.debounceTimerRef.current);
    deps.debounceTimerRef.current = null;
  }

  if (deps.isPending) {
    // A mutation is already in flight. Queue for after success.
    deps.queuedKeyRef.current = currentKey;
    deps.queuedPayloadRef.current = current;
    return;
  }

  deps.setState("saving");
  deps.inFlightRef.current = currentKey;
  deps.inFlightPayloadRef.current = current;
  deps.inFlightSectionRef.current = sectionId;
  await deps.getMutateAsync()({
    ...current,
    reportSectionId: sectionId,
    version: deps.versionRef.current,
  });
}
