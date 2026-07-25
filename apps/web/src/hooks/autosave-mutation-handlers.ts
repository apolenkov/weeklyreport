import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { isConflictError } from "../lib/trpc";
import type { AutosaveState, DraftSaveContent } from "./autosave-types";

// Lazy getMutate/getCurrentSectionId so deps can be built before those refs exist.
export interface SaveDraftHandlerDeps {
  readonly versionRef: RefObject<number>;
  readonly lastSavedRef: RefObject<string>;
  readonly inFlightRef: RefObject<string>;
  readonly inFlightPayloadRef: RefObject<DraftSaveContent | null>;
  readonly inFlightSectionRef: RefObject<string | null>;
  readonly queuedKeyRef: RefObject<string | null>;
  readonly queuedPayloadRef: RefObject<DraftSaveContent | null>;
  readonly getMutate: () => (payload: DraftSavePayload) => void;
  readonly getCurrentSectionId: () => string | null;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  readonly setQueuedRetryRevision: Dispatch<SetStateAction<number>>;
  readonly onVersionChange: (version: number) => void;
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
  ) => void;
  readonly onConflict?: () => void;
  readonly reportSectionId: string | null;
  readonly invalidate: () => void;
  readonly reportError: (message: string) => void;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(deps: SaveDraftHandlerDeps): void {
  if (deps.queuedKeyRef.current === null) return;
  const queued = deps.queuedPayloadRef.current;
  const queuedKey = deps.queuedKeyRef.current;
  deps.queuedKeyRef.current = null;
  deps.queuedPayloadRef.current = null;
  if (queued === null || queuedKey === deps.lastSavedRef.current) return;
  deps.setState("saving");
  deps.inFlightRef.current = queuedKey;
  deps.inFlightPayloadRef.current = queued;
  deps.inFlightSectionRef.current = queued.reportSectionId;
  // mutate (not mutateAsync) avoids unhandled rejection; inject the bumped version.
  deps.getMutate()({ ...queued, version: deps.versionRef.current });
}

export function buildSaveDraftHandlers(deps: SaveDraftHandlerDeps): {
  onSuccess: (saved: ReportSectionReadModel) => void;
  onError: (err: unknown) => void;
} {
  return {
    onSuccess: (saved) => {
      // Bump version before drain so a queued save rebases instead of self-409ing.
      deps.versionRef.current = saved.version;
      deps.onVersionChange(saved.version);

      // Skip baseline stamp after navigation — would clobber the new section's prime.
      if (deps.inFlightSectionRef.current === deps.getCurrentSectionId()) {
        deps.lastSavedRef.current = deps.inFlightRef.current;
      }
      if (deps.inFlightPayloadRef.current !== null) {
        deps.onSaved?.(saved, deps.inFlightPayloadRef.current);
      }
      deps.setState("saved");
      deps.setLastSavedAt(new Date());
      deps.invalidate();

      drainQueuedSave(deps);
    },
    onError: (err: unknown) => {
      const queuedSectionId =
        deps.queuedPayloadRef.current?.reportSectionId ?? null;
      deps.queuedKeyRef.current = null;
      deps.queuedPayloadRef.current = null;
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
