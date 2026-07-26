import type { ReportSectionReadModel } from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";

import { isConflictError } from "../lib/trpc";
import type { GetAutosaveRefs } from "./autosave-refs";
import type { AutosaveState, DraftSaveContent } from "./autosave-types";

export interface SaveDraftHandlerDeps {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  readonly setQueuedRetryRevision: Dispatch<SetStateAction<number>>;
  readonly onVersionChange: (version: number) => void;
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
  ) => void;
  readonly onConflict?: () => void;
  // Section captured at render, NOT the live one: the onError re-arm must only
  // fire for the form the caller is currently showing.
  readonly reportSectionId: string | null;
  readonly invalidate: () => void;
  readonly reportError: (message: string) => void;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(deps: SaveDraftHandlerDeps): void {
  const refs = deps.getRefs();
  if (refs.queuedKey === null) return;
  const queued = refs.queuedPayload;
  const queuedKey = refs.queuedKey;
  refs.queuedKey = null;
  refs.queuedPayload = null;
  if (queued === null || queuedKey === refs.lastSaved) return;
  deps.setState("saving");
  refs.inFlight = queuedKey;
  refs.inFlightPayload = queued;
  refs.inFlightSection = queued.reportSectionId;
  // mutate (not mutateAsync) avoids unhandled rejection; inject the bumped version.
  refs.mutate({ ...queued, version: refs.version });
}

export function buildSaveDraftHandlers(deps: SaveDraftHandlerDeps): {
  onSuccess: (saved: ReportSectionReadModel) => void;
  onError: (err: unknown) => void;
} {
  return {
    onSuccess: (saved) => {
      const refs = deps.getRefs();
      // Bump version before drain so a queued save rebases instead of self-409ing.
      refs.version = saved.version;
      deps.onVersionChange(saved.version);

      // Skip baseline stamp after navigation — would clobber the new section's prime.
      if (refs.inFlightSection === refs.sectionId) {
        refs.lastSaved = refs.inFlight;
      }
      if (refs.inFlightPayload !== null) {
        deps.onSaved?.(saved, refs.inFlightPayload);
      }
      deps.setState("saved");
      deps.setLastSavedAt(new Date());
      deps.invalidate();

      drainQueuedSave(deps);
    },
    onError: (err: unknown) => {
      const refs = deps.getRefs();
      const queuedSectionId = refs.queuedPayload?.reportSectionId ?? null;
      refs.queuedKey = null;
      refs.queuedPayload = null;
      deps.setState("error");
      // 409: hand off to the conflict flow (refetch) — retrying the stale version would 409 again.
      if (deps.onConflict && isConflictError(err)) {
        deps.onConflict();
        return;
      }
      // Re-arm only if the queued edit still targets the form's current section.
      if (
        queuedSectionId !== null &&
        queuedSectionId === deps.reportSectionId
      ) {
        deps.setQueuedRetryRevision((revision) => revision + 1);
      }
      const msg =
        err instanceof Error && err.message ? err.message : "Autosave failed";
      deps.reportError(msg);
    },
  };
}
