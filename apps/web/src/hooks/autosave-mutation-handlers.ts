import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { isConflictError } from "../lib/trpc";
import type { AutosaveState, DraftSaveContent } from "./autosave-types";

/**
 * Wiring for the saveDraft mutation callbacks. All mutable state lives in the
 * hook's refs; the handlers read and advance them at event time. `getMutate`
 * and `getCurrentSectionId` are lazy so the deps object can be built at the
 * `useMutation` call site, before those refs are declared.
 */
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

/**
 * Drain a queued save (if any) to the section it was BUILT for — never the
 * latest section. The hook is not remounted on navigation, so the queued
 * payload's own reportSectionId is the only safe target.
 */
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
  // Fire-and-forget: the mutation's own onSuccess/onError drive the result and
  // the next drain. `mutate` (not `mutateAsync`) so no unhandled rejection
  // leaks from a discarded promise. Inject the just-bumped version so the drain
  // compare-and-sets against it.
  deps.getMutate()({ ...queued, version: deps.versionRef.current });
}

export function buildSaveDraftHandlers(deps: SaveDraftHandlerDeps): {
  onSuccess: (saved: ReportSectionReadModel) => void;
  onError: (err: unknown) => void;
} {
  return {
    onSuccess: (saved) => {
      // Advance the live version from the server-confirmed value FIRST, so the
      // drain below rebases the queued save onto the bumped version (otherwise
      // it would replay the stale version and self-409). Then push it to the
      // owning component (single source) for submit/fillFrom.
      deps.versionRef.current = saved.version;
      deps.onVersionChange(saved.version);

      // Stamp the confirmed baseline ONLY if the lead is still on the section
      // this save targeted. If they navigated away while it was in flight,
      // stamping would clobber the new section's freshly-primed baseline and
      // make it falsely read dirty (scheduling a spurious save there).
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
      // A stale-version 409 means another writer advanced the section; hand off
      // to the caller (refetch + surface) instead of a generic toast. No retry
      // re-arm: replaying against the stale version would 409 again — the
      // conflict flow rebuilds state from the refetch.
      if (deps.onConflict && isConflictError(err)) {
        deps.onConflict();
        return;
      }
      // Re-arm the debounce only when the queued edit still belongs to the
      // section the form shows — after navigation the current payload no longer
      // carries the queued content, so a silent replay would save the wrong
      // section's state.
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
