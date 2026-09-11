import type { ReportSectionReadModel } from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";

import { isLeadFormWriteConflict } from "../lead-form/lead-form-write-port";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveRequest, GetAutosaveRefs } from "./autosave-refs";
import type {
  AutosaveState,
  DraftSaveContent,
  UseLeadFormAutosaveArgs,
} from "./autosave-types";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import { reconcileSavedPayloadIdentities } from "./lead-form-draft-reconcile";

export interface SaveDraftHandlerDeps {
  readonly getRefs: GetAutosaveRefs;
  readonly setState: Dispatch<SetStateAction<AutosaveState>>;
  readonly setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  readonly setLastSavedKey: (next: string) => void;
  readonly setQueuedRetryRevision: Dispatch<SetStateAction<number>>;
  readonly onVersionChange: (version: number) => void;
  readonly onSaved?: UseLeadFormAutosaveArgs["onSaved"] | undefined;
  readonly onConflict?: (() => void) | undefined;
  // Section captured at render, NOT the live one: the onError re-arm must only
  // fire for the form the caller is currently showing.
  readonly reportSectionId: string | null;
  readonly reportError: (message: string) => void;
}

// Drain to the section the queue was built for — the hook survives navigation.
function drainQueuedSave(deps: SaveDraftHandlerDeps): void {
  const refs = deps.getRefs();
  const queued = refs.queued;
  refs.queued = null;
  if (queued === null) return;
  const current = queued.generation === refs.generation;
  if (current && (!refs.enabled || queued.key === refs.lastSaved)) return;
  if (current) deps.setState("saving");
  refs.mutate({
    ...queued,
    version: current ? Math.max(refs.version, queued.version) : queued.version,
  });
}

function reconcileQueuedSave(
  deps: SaveDraftHandlerDeps,
  generation: symbol,
  saved: ReportSectionReadModel,
  payload: DraftSaveContent,
) {
  const refs = deps.getRefs();
  const queued = refs.queued;
  if (queued?.generation !== generation) return;
  const next = reconcileSavedPayloadIdentities(
    queued.payload,
    sectionToDraftPayload(saved),
    payload,
  );
  refs.queued = {
    ...queued,
    payload: next,
    key: encodeDraftSaveComparisonKey(next),
    version: Math.max(queued.version, saved.version),
  };
}

export function buildSaveDraftHandlers(deps: SaveDraftHandlerDeps): {
  onSuccess: (saved: ReportSectionReadModel, request: AutosaveRequest) => void;
  onError: (err: unknown, generation: symbol) => void;
} {
  return {
    onSuccess: (saved, request) => {
      const { payload, generation } = request;
      const refs = deps.getRefs();
      if (
        generation !== refs.generation ||
        saved.reportSectionId !== refs.sectionId ||
        saved.version < refs.version
      ) {
        if (generation !== refs.generation) {
          reconcileQueuedSave(deps, generation, saved, payload);
        }
        drainQueuedSave(deps);
        return;
      }
      // Bump version before drain so a queued save rebases instead of self-409ing.
      refs.version = saved.version;
      deps.onVersionChange(saved.version);

      const queued =
        refs.queued?.generation === generation ? refs.queued : null;
      const reconciliation = deps.onSaved?.(
        saved,
        payload,
        queued?.payload ?? null,
      );
      if (reconciliation && queued) {
        const next = reconciliation.queuedPayload;
        refs.queued =
          next === null
            ? null
            : {
                ...queued,
                payload: next,
                key: encodeDraftSaveComparisonKey(next),
                version: Math.max(queued.version, saved.version),
              };
      }
      const savedKey = reconciliation?.savedKey ?? request.key;
      refs.lastSaved = savedKey;
      deps.setLastSavedKey(savedKey);
      deps.setState("saved");
      deps.setLastSavedAt(new Date());
      drainQueuedSave(deps);
    },
    onError: (err, generation) => {
      const refs = deps.getRefs();
      if (generation !== refs.generation) {
        if (refs.queued?.generation === generation) refs.queued = null;
        drainQueuedSave(deps);
        return;
      }
      const queuedSectionId = refs.queued?.payload.reportSectionId ?? null;
      refs.queued = null;
      deps.setState("error");
      // 409: hand off to the conflict flow (refetch) — retrying the stale version would 409 again.
      if (deps.onConflict && isLeadFormWriteConflict(err)) {
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
