"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useCallback, useState } from "react";

import {
  type LeadFormGeneration,
  leadFormGenerationOf,
} from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import {
  useConflictReload,
  useDraftPayload,
  useDraftSubmit,
  useDraftVersion,
  useGenerationCapture,
} from "./use-lead-form-draft-parts";
import { useDraftOutcomes, useDraftSync } from "./use-lead-form-draft-wiring";

interface LeadFormDraftCoreArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionIdForActions: string | null;
  readonly serverReadOnly: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

// The local draft engine: editable section state, its optimistic-lock version,
// and the autosave/reseed conversation with the server.
export function useLeadFormDraftCore({
  writePort,
  generation,
  serverSection,
  sectionIdForActions,
  serverReadOnly,
  refetchSection,
}: LeadFormDraftCoreArgs) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [draftSection, setDraftSection] =
    useState<ReportSectionReadModel | null>(null);
  const { version, versionRef, setVersionSafe, acceptVersion } =
    useDraftVersion(sectionIdForActions);
  const captureGeneration = useGenerationCapture(generation);
  const handleConflict = useConflictReload(refetchSection, captureGeneration);
  const draftPayload = useDraftPayload(draftSection);
  const serverSync = useDraftSync({
    writePort,
    generation,
    serverSection,
    sectionId: sectionIdForActions,
    draftSection,
    draftPayload,
    readOnly: isSubmitted || serverReadOnly,
    version,
    setVersionSafe,
    acceptVersion,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
  const { outcomeCoordinator, apply, outcomes } = useDraftOutcomes({
    writePort,
    generation,
    sectionId: sectionIdForActions,
    draftSection,
    version,
    serverSync,
    serverReadOnly,
    isSubmitted,
    acceptVersion,
    setDraftSection,
  });
  const markUnsubmitted = useCallback(() => setIsSubmitted(false), []);
  const draftGeneration =
    draftSection === null ? null : leadFormGenerationOf(draftSection);
  const submit = useDraftSubmit({
    writePort,
    generation,
    sectionIdForActions,
    draftPayload,
    draftGeneration,
    versionRef,
    isOutcomeLocked: outcomeCoordinator.isLocked,
    captureGeneration,
    acceptVersion,
    handleConflict,
    setIsSubmitted,
  });
  return {
    generation,
    draft: draftSection,
    draftPayload,
    dirty: serverSync.autosave.dirty,
    ...serverSync,
    outcomes,
    version,
    isSubmitted,
    markUnsubmitted,
    setVersionSafe,
    save: serverSync.autosave.forceSave,
    savePersisted: serverSync.autosave.savePersisted,
    abandonPersisted: serverSync.autosave.abandonPersisted,
    submit,
    reloadAfterConflict: handleConflict,
    apply,
  };
}
