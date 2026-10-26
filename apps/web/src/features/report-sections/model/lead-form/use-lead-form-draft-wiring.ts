"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { type Dispatch, type SetStateAction, useMemo } from "react";

import { useDraftServerSync } from "../autosave/use-lead-form-server-sync";
import { countLocalOnlyRows } from "../lead-section-draft-payload";
import type { LeadFormGeneration } from "./lead-form-generation";
import type { LeadFormWritePort } from "./lead-form-write-port";
import { useStageMemoryApply } from "./use-draft-stage-memory";
import {
  type useDraftPayload,
  useGenerationBoundApply,
  useOutcomeActions,
} from "./use-lead-form-draft-parts";
import { useLeadFormOutcomeCoordinator } from "./use-lead-form-outcome-coordinator";

interface DraftSyncArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly serverSection: ReportSectionReadModel | null | undefined;
  readonly sectionId: string | null;
  readonly draftSection: ReportSectionReadModel | null;
  readonly draftPayload: ReturnType<typeof useDraftPayload>;
  readonly readOnly: boolean;
  readonly version: number;
  readonly setVersionSafe: (next: number) => void;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly setIsSubmitted: Dispatch<SetStateAction<boolean>>;
  readonly setDraftSection: Dispatch<
    SetStateAction<ReportSectionReadModel | null>
  >;
  readonly handleConflict: () => void;
}

export function useDraftSync({
  writePort,
  generation,
  serverSection,
  sectionId,
  draftSection,
  draftPayload,
  readOnly,
  version,
  setVersionSafe,
  acceptVersion,
  setIsSubmitted,
  setDraftSection,
  handleConflict,
}: DraftSyncArgs) {
  // Partially typed rows never reach the payload, so the autosave key cannot see
  // them. The reseed and unload paths still treat them as local edits.
  const localOnlyRows =
    draftSection === null ? 0 : countLocalOnlyRows(draftSection);
  const receiptScope = useMemo(
    () => `${generation ?? "inactive"}:${crypto.randomUUID()}`,
    [generation],
  );
  return useDraftServerSync({
    generation,
    receiptScope,
    writePort,
    serverSection,
    reportSectionId: sectionId || null,
    payload: draftPayload,
    enabled: !readOnly && draftSection !== null,
    localOnlyRows,
    version,
    setVersionSafe,
    acceptVersion,
    setIsSubmitted,
    setDraftSection,
    handleConflict,
  });
}

interface DraftOutcomesArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly sectionId: string | null;
  readonly draftSection: ReportSectionReadModel | null;
  readonly version: number;
  readonly serverSync: ReturnType<typeof useDraftSync>;
  readonly serverReadOnly: boolean;
  readonly isSubmitted: boolean;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly setDraftSection: Dispatch<
    SetStateAction<ReportSectionReadModel | null>
  >;
}

export function useDraftOutcomes({
  writePort,
  generation,
  sectionId,
  draftSection,
  version,
  serverSync,
  serverReadOnly,
  isSubmitted,
  acceptVersion,
  setDraftSection,
}: DraftOutcomesArgs) {
  const outcomeCoordinator = useLeadFormOutcomeCoordinator({
    writePort,
    generation,
    sectionId,
    draftSection,
    version,
    autosave: serverSync.autosave,
    readOnly: serverReadOnly,
    submitted: isSubmitted,
    acceptVersion,
    adoptServerSection: serverSync.adoptServerSection,
  });
  const applyDraft = useGenerationBoundApply(
    generation,
    setDraftSection,
    outcomeCoordinator.isLocked,
  );
  // Every record save enters the draft as a patch; remembering the changed
  // stage selections at this single seam covers Item, Risk and Decision saves
  // from any surface and keeps Cancel out of the memory.
  const apply = useStageMemoryApply({
    apply: applyDraft,
    draftSection,
    stageMemory: serverSync.stageMemory,
  });
  const outcomes = useOutcomeActions(outcomeCoordinator);
  return { outcomeCoordinator, apply, outcomes };
}
