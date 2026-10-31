"use client";

import type { ReportSectionReadModel } from "@weeklyreport/shared";
import type { ReactNode, RefObject } from "react";
import { useState } from "react";

import {
  type DecisionEntry,
  type KanbanItem,
  type MappedLeadForm,
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
  useInlineEditDialogData,
  useSlideDraftSaveMutation,
} from "./use-slide-inline-editor-support";

interface UseSlideInlineEditorArgs {
  readonly section: ReportSectionReadModel | null;
  readonly formData: MappedLeadForm | null;
  readonly canInlineEdit: boolean;
  readonly refetchSection: () => Promise<unknown>;
  // Stable container that takes focus when a delete removes its opener (C5246).
  readonly restoreFocusFallbackRef?: RefObject<HTMLElement | null> | undefined;
}

interface SlideInlineEditor {
  readonly onRowActivate?: ((ref: GridRowEditableRef) => void) | undefined;
  readonly dialogs: ReactNode;
  // An edit dialog or delete confirmation is open, so its draft is unsaved.
  readonly hasOpenDialog: boolean;
}

type ActiveRecord = { readonly ref: GridRowEditableRef } | null;
type ScopedRecordRef = {
  readonly sectionId: string;
  readonly ref: GridRowEditableRef;
} | null;
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

function saveActiveRecord<T>(
  context: Pick<InlineSaveHandlersArgs, "section" | "saveDraftSection">,
  active: ActiveRecord,
  applyEdit: ApplyEdit<T>,
  next: T,
) {
  const { section, saveDraftSection } = context;
  if (section === null || active === null) return;
  saveDraftSection(
    section,
    applyEdit(section, active.ref.stableId, next),
    "saved",
  );
}

interface InlineSaveHandlersArgs {
  readonly section: ReportSectionReadModel | null;
  readonly inlineEditRecord: ReturnType<
    typeof useInlineEditDialogData
  >["inlineEditRecord"];
  readonly pendingDeleteRef: GridRowEditableRef | null;
  readonly saveDraftSection: SaveDraftSection;
  readonly closePendingDelete: () => void;
}

function createInlineSaveHandlers(args: InlineSaveHandlersArgs) {
  const {
    section,
    inlineEditRecord,
    pendingDeleteRef,
    saveDraftSection,
    closePendingDelete,
  } = args;
  const activeItem = getActiveItemRecord(inlineEditRecord);
  const activeRisk = getActiveRiskRecord(inlineEditRecord);
  const activeDecision = getActiveDecisionRecord(inlineEditRecord);

  function onConfirmDelete() {
    if (section === null || pendingDeleteRef === null) {
      // The row this confirmation pointed at is gone; an open dialog with a
      // dead Confirm is worse than closing it.
      closePendingDelete();
      return;
    }
    saveDraftSection(
      section,
      deleteSlideInlineRecord(section, pendingDeleteRef),
      "deleted",
    );
  }
  function onItemSave(next: KanbanItem) {
    saveActiveRecord(args, activeItem, applySlideInlineItemEdit, next);
  }
  function onRiskSave(next: RiskEntry) {
    saveActiveRecord(args, activeRisk, applySlideInlineRiskEdit, next);
  }
  function onDecisionSave(next: DecisionEntry) {
    saveActiveRecord(args, activeDecision, applySlideInlineDecisionEdit, next);
  }

  return { onConfirmDelete, onItemSave, onRiskSave, onDecisionSave };
}

function useInlineEditCommands({
  section,
  formData,
  canInlineEdit,
  refetchSection,
}: UseSlideInlineEditorArgs) {
  const [inlineEdit, setInlineEdit] = useState<ScopedRecordRef>(null);
  const [pendingDeleteRef, setPendingDeleteRef] =
    useState<ScopedRecordRef>(null);
  // Refs belong to the section that opened them; reset on section change.
  // Adjusting state during render keeps the reset out of an effect.
  const sectionId = section?.reportSectionId ?? null;
  const [prevSectionId, setPrevSectionId] = useState(sectionId);
  if (sectionId !== prevSectionId) {
    setPrevSectionId(sectionId);
    setInlineEdit(null);
    setPendingDeleteRef(null);
  }
  const clearActive = (sectionId: string) => {
    setInlineEdit((current) =>
      current?.sectionId === sectionId ? null : current,
    );
    setPendingDeleteRef((current) =>
      current?.sectionId === sectionId ? null : current,
    );
  };
  const { saveDraftSection, isPending } = useSlideDraftSaveMutation({
    refetchSection,
    onSaved: clearActive,
  });
  const dialogData = useInlineEditDialogData({
    section,
    formData,
    inlineEditRef:
      inlineEdit?.sectionId === section?.reportSectionId
        ? (inlineEdit?.ref ?? null)
        : null,
    pendingDeleteRef:
      pendingDeleteRef?.sectionId === section?.reportSectionId
        ? (pendingDeleteRef?.ref ?? null)
        : null,
  });
  const saveHandlers = createInlineSaveHandlers({
    section,
    inlineEditRecord: dialogData.inlineEditRecord,
    pendingDeleteRef: dialogData.pendingDeleteRecord?.ref ?? null,
    saveDraftSection,
    closePendingDelete: () => setPendingDeleteRef(null),
  });

  function handleRowActivate(ref: GridRowEditableRef) {
    if (isPending || !canInlineEdit || section === null || formData === null)
      return;
    if (resolveSlideInlineRecord(section, formData, ref) === null) return;
    setInlineEdit({ sectionId: section.reportSectionId, ref });
  }

  function requestInlineDelete() {
    if (isPending || section === null || dialogData.inlineEditRecord === null)
      return;
    // Close the edit dialog when the delete confirmation takes over, so the
    // confirm never renders on top of a still-mounted, still-open editor.
    setInlineEdit(null);
    setPendingDeleteRef({
      sectionId: section.reportSectionId,
      ref: dialogData.inlineEditRecord.ref,
    });
  }

  return {
    ...dialogData,
    ...saveHandlers,
    isPending,
    onRowActivate: canInlineEdit ? handleRowActivate : undefined,
    onCancelEdit: () => {
      if (!isPending) setInlineEdit(null);
    },
    onRequestDelete: requestInlineDelete,
    onCancelDelete: () => {
      if (!isPending) setPendingDeleteRef(null);
    },
  };
}

export function useSlideInlineEditor(
  args: UseSlideInlineEditorArgs,
): SlideInlineEditor {
  const commands = useInlineEditCommands(args);
  return {
    onRowActivate: commands.onRowActivate,
    hasOpenDialog:
      commands.inlineEditRecord !== null ||
      commands.pendingDeleteRecord !== null,
    dialogs: (
      <SlideInlineEditorDialogs
        isPending={commands.isPending}
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
        restoreFocusFallbackRef={args.restoreFocusFallbackRef}
      />
    ),
  };
}
