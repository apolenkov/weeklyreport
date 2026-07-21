"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  type DecisionEntry,
  type KanbanItem,
  type RiskEntry,
} from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import {
  applySlideInlineDecisionEdit,
  applySlideInlineItemEdit,
  applySlideInlineRiskEdit,
  deleteSlideInlineRecord,
} from "../model/slide-inline-draft";
import { resolveSlideInlineRecord } from "../model/slide-inline-edit";
import {
  getActiveDecisionRecord,
  getActiveItemRecord,
  getActiveRiskRecord,
  SlideInlineEditorDialogs,
} from "./slide-inline-editor-dialogs";
import {
  type LeadSlideFormData,
  useInlineEditDialogData,
  useSlideDraftSaveMutation,
} from "./use-slide-inline-editor-support";

interface UseSlideInlineEditorArgs {
  readonly section: ReportSectionReadModel | null;
  readonly formData: LeadSlideFormData | null;
  readonly canInlineEdit: boolean;
  readonly refetchSection: () => void;
}

interface SlideInlineEditor {
  readonly onRowActivate?: (ref: GridRowEditableRef) => void;
  readonly dialogs: ReactNode;
}

type ActiveRecord = { readonly ref: GridRowEditableRef } | null;
type ApplyEdit<T> = (
  section: ReportSectionReadModel,
  stableId: string,
  next: T,
) => ReportSectionReadModel;
type SaveDraftSection = (
  section: ReportSectionReadModel,
  nextSection: ReportSectionReadModel,
  operation: "saved" | "deleted",
) => void;

/** Shared body of the three inline-edit save handlers: no-op when the section
 * or the corresponding active record is absent, otherwise apply the edit and
 * hand the resulting section to the draft-save mutation. */
function saveActiveRecord<T>(
  section: ReportSectionReadModel | null,
  active: ActiveRecord,
  applyEdit: ApplyEdit<T>,
  next: T,
  saveDraftSection: SaveDraftSection,
) {
  if (section === null || active === null) return;
  saveDraftSection(
    section,
    applyEdit(section, active.ref.stableId, next),
    "saved",
  );
}

/** The four commands that resolve to a `saveDraftSection` call: delete the
 * pending record, or save whichever row kind is currently open. */
function useInlineSaveHandlers({
  section,
  inlineEditRecord,
  pendingDeleteRef,
  saveDraftSection,
}: {
  readonly section: ReportSectionReadModel | null;
  readonly inlineEditRecord: ReturnType<
    typeof useInlineEditDialogData
  >["inlineEditRecord"];
  readonly pendingDeleteRef: GridRowEditableRef | null;
  readonly saveDraftSection: SaveDraftSection;
}) {
  const activeItem = getActiveItemRecord(inlineEditRecord);
  const activeRisk = getActiveRiskRecord(inlineEditRecord);
  const activeDecision = getActiveDecisionRecord(inlineEditRecord);

  function onConfirmDelete() {
    if (section === null || pendingDeleteRef === null) return;
    saveDraftSection(
      section,
      deleteSlideInlineRecord(section, pendingDeleteRef),
      "deleted",
    );
  }
  function onItemSave(next: KanbanItem) {
    saveActiveRecord(
      section,
      activeItem,
      applySlideInlineItemEdit,
      next,
      saveDraftSection,
    );
  }
  function onRiskSave(next: RiskEntry) {
    saveActiveRecord(
      section,
      activeRisk,
      applySlideInlineRiskEdit,
      next,
      saveDraftSection,
    );
  }
  function onDecisionSave(next: DecisionEntry) {
    saveActiveRecord(
      section,
      activeDecision,
      applySlideInlineDecisionEdit,
      next,
      saveDraftSection,
    );
  }

  return { onConfirmDelete, onItemSave, onRiskSave, onDecisionSave };
}

/** Owns the two pieces of inline-edit state (which row is open / pending
 * delete) and composes the derived dialog data with the save/delete/activate
 * commands into the shape `SlideInlineEditorDialogs` expects. */
function useInlineEditCommands({
  section,
  formData,
  canInlineEdit,
  refetchSection,
}: UseSlideInlineEditorArgs) {
  const [inlineEditRef, setInlineEditRef] = useState<GridRowEditableRef | null>(
    null,
  );
  const [pendingDeleteRef, setPendingDeleteRef] =
    useState<GridRowEditableRef | null>(null);
  const clearActive = () => {
    setInlineEditRef(null);
    setPendingDeleteRef(null);
  };
  const { saveDraftSection } = useSlideDraftSaveMutation({
    refetchSection,
    onSaved: clearActive,
  });
  const dialogData = useInlineEditDialogData({
    section,
    formData,
    inlineEditRef,
    pendingDeleteRef,
  });
  const saveHandlers = useInlineSaveHandlers({
    section,
    inlineEditRecord: dialogData.inlineEditRecord,
    pendingDeleteRef,
    saveDraftSection,
  });

  function handleRowActivate(ref: GridRowEditableRef) {
    if (!canInlineEdit || section === null || formData === null) return;
    if (resolveSlideInlineRecord(section, formData, ref) === null) return;
    setInlineEditRef(ref);
  }

  function requestInlineDelete() {
    if (dialogData.inlineEditRecord === null) return;
    setPendingDeleteRef(dialogData.inlineEditRecord.ref);
  }

  return {
    ...dialogData,
    ...saveHandlers,
    onRowActivate: canInlineEdit ? handleRowActivate : undefined,
    onCancelEdit: () => setInlineEditRef(null),
    onRequestDelete: requestInlineDelete,
    onCancelDelete: () => setPendingDeleteRef(null),
  };
}

export function useSlideInlineEditor(
  args: UseSlideInlineEditorArgs,
): SlideInlineEditor {
  const commands = useInlineEditCommands(args);
  return {
    onRowActivate: commands.onRowActivate,
    dialogs: (
      <SlideInlineEditorDialogs
        inlineEditRecord={commands.inlineEditRecord}
        pendingDeleteRecord={commands.pendingDeleteRecord}
        currentUserName={args.formData?.currentUser.name}
        dialogProducts={commands.dialogProducts}
        dialogActivities={commands.dialogActivities}
        dialogRanks={commands.dialogRanks}
        dialogRisks={commands.dialogRisks}
        stagesForProduct={commands.stagesForProduct}
        onItemSave={commands.onItemSave}
        onRiskSave={commands.onRiskSave}
        onDecisionSave={commands.onDecisionSave}
        onCancelEdit={commands.onCancelEdit}
        onRequestDelete={commands.onRequestDelete}
        onConfirmDelete={commands.onConfirmDelete}
        onCancelDelete={commands.onCancelDelete}
      />
    ),
  };
}
