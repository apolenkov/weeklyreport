"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useCallback, useEffect, useRef } from "react";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import type { AutosaveController, AutosaveRequest } from "./autosave-types";
import { useConflictRetainedEdits } from "./conflict-retained-edits";
import { encodeDraftSaveComparisonKey } from "./draft-save-comparison-key";
import { useLeadFormAutosave } from "./use-lead-form-autosave";
import {
  type SaveEchoLedger,
  sectionRevision,
  type SetDraftSection,
} from "./use-server-section-reseed";

// A refused stale save reverts the draft to the last server section at once,
// whatever arrived while the save was in flight, exactly like the reseed of an
// external change; the conflict refetch then lands on a clean draft, while the
// Lead's own item text and unfinished records are retained over the next newer revision. The
// autosave controller exists only after the conflict callback, hence the refs.
export function useAutosaveWithStaleRevert({
  serverSection,
  ledger,
  setDraftSection: setDraftSectionRaw,
  handleConflict,
  autosaveArgs,
}: {
  readonly autosaveArgs: Omit<
    Parameters<typeof useLeadFormAutosave>[0],
    "onConflict"
  >;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly ledger: SaveEchoLedger;
  readonly setDraftSection: SetDraftSection;
  readonly handleConflict: () => void;
}) {
  const latestServerSectionRef = useRef<
    ReportSectionReadModel | null | undefined
  >(null);
  const autosaveRef = useRef<AutosaveController | null>(null);
  useEffect(() => {
    latestServerSectionRef.current = serverSection;
  });
  const retained = useConflictRetainedEdits({
    acceptedVersion: autosaveArgs.version,
    serverSection,
    setDraftSection: setDraftSectionRaw,
    payload: autosaveArgs.payload,
  });
  const setDraftSection = retained.setDraftSection;
  const { capture } = retained;
  const handleSaveConflict = useCallback(
    (contextualAttempt?: boolean, failed?: AutosaveRequest) => {
      const captured =
        !contextualAttempt && failed ? capture(failed) : undefined;
      const section = captured ?? latestServerSectionRef.current;
      if (section && !contextualAttempt) {
        const serverDraftKey = encodeDraftSaveComparisonKey(
          sectionToDraftPayload(section),
        );
        ledger.consume(serverDraftKey, sectionRevision(section));
        if (!failed || section.version > failed.version)
          autosaveRef.current?.adoptBaseline(serverDraftKey, "read");
        setDraftSection(section);
      }
      handleConflict();
    },
    [capture, handleConflict, ledger, setDraftSection],
  );
  const autosave = useLeadFormAutosave({
    ...autosaveArgs,
    heldKey: retained.heldKey,
    onConflict: handleSaveConflict,
    onUncertainWrite: capture,
    onSaved: (...saved) => {
      retained.rememberSaved(saved[0]);
      return (
        autosaveArgs.onSaved?.(...saved) ?? {
          savedKey: encodeDraftSaveComparisonKey(
            sectionToDraftPayload(saved[0]),
          ),
          queuedPayload: saved[2],
        }
      );
    },
  });
  useEffect(() => {
    autosaveRef.current = autosave;
  });
  return { autosave, setDraftSection };
}
