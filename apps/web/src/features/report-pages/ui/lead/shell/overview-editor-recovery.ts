import type {
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@customreport/shared";

import {
  type KanbanItem,
  mapLeadItems,
  type StatusOverviewCreateTarget,
  type StatusOverviewItem,
  type StatusOverviewModel,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function buildPriorPlanSeed(
  output: LeadStatusOverviewOutput | undefined,
  currentSection: ReportSectionReadModel,
  model: StatusOverviewModel,
  item: StatusOverviewItem,
): { target: StatusOverviewCreateTarget; seed: KanbanItem } | null {
  if (
    output?.predecessor.availability !== "available" ||
    item.source !== "previous" ||
    !item.recordId ||
    !item.stableId
  )
    return null;
  const recordId = item.recordId;
  const stableId = item.stableId;
  if (currentSection.items.some((candidate) => candidate.stableId === stableId))
    return null;
  const unit = model.units.find(
    (candidate) =>
      !candidate.historical &&
      candidate.columns.previouslyPlanned.items.some(
        (candidateItem) => candidateItem.key === item.key,
      ),
  );
  const predecessor = output.predecessor.section.items.find(
    (candidate) => candidate.id === recordId && candidate.stableId === stableId,
  );
  const mapped = predecessor
    ? mapLeadItems(output.predecessor.section, predecessor.type).find(
        (candidate) => candidate.id === predecessor.id,
      )
    : undefined;
  if (!unit || !mapped) return null;
  const target: StatusOverviewCreateTarget = {
    source: "current",
    unitKind: unit.kind,
    unitId: unit.id,
  };
  const seed: KanbanItem =
    unit.kind === "activity"
      ? {
          ...mapped,
          stableId,
          text: item.text,
          nextStepText: null,
          parent: { kind: "activity", id: unit.id },
          productId: null,
          productName: unit.name,
          activityId: unit.id,
          activityName: unit.name,
          stageNames: [],
        }
      : {
          ...mapped,
          stableId,
          text: item.text,
          nextStepText: null,
          parent: { kind: "product", id: unit.id },
          productId: unit.id,
          productName: unit.name,
          activityId: null,
          activityName: undefined,
        };
  return { target, seed };
}

function authoredFields(item: KanbanItem) {
  return JSON.stringify({
    text: item.text,
    tag: item.tag ?? "general",
    nextStepText: item.nextStepText ?? null,
    status: item.status,
    parent: item.parent,
    stageNames: item.stageNames,
    priorityRank: item.priorityRank ?? null,
    pausedReason: item.pausedReason ?? null,
  });
}

function projectedItems(editor: ReadyEditor, dialog: OverviewItemDialogState) {
  return dialog.week === "current"
    ? editor.view.viewModel.ownCurrentWeekItems
    : editor.view.viewModel.ownNextWeekItems;
}

function findAcknowledgedItem(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): KanbanItem | undefined {
  const submission = dialog.submission;
  const receipt = editor.draft.lastSaveReceipt;
  if (
    !submission?.saveArmed ||
    !receipt?.persistedItems ||
    dialog.generation !== editor.generation ||
    receipt.scope !== submission.receiptScope ||
    receipt.scope !== editor.draft.receiptScope ||
    receipt.attemptToken !== submission.token ||
    receipt.sequence <= submission.saveReceiptSequenceBefore ||
    receipt.generation !== dialog.generation ||
    receipt.reportSectionId !== editor.draft.section.reportSectionId ||
    receipt.version <= submission.draftVersionBefore
  )
    return undefined;
  const identity = receipt.itemIdentities.find(
    (candidate) => candidate.clientId === submission.item.id,
  );
  if (!identity?.stableId) return undefined;
  const stableId = identity.stableId;
  const persisted = receipt.persistedItems.find(
    (row) =>
      row.id === identity.serverId &&
      row.stableId?.localeCompare(stableId) === 0,
  );
  if (persisted?.type !== dialog.week) return undefined;
  const confirmed = mapLeadItems(
    { ...editor.draft.section, items: receipt.persistedItems },
    dialog.week,
  ).find((row) => row.id === identity.serverId);
  return confirmed && overviewItemFieldsUnchanged(submission.item, confirmed)
    ? confirmed
    : undefined;
}

export function overviewSubmittedItemIsCurrent(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): boolean {
  const submitted = dialog.submission?.item;
  if (!submitted) return false;
  const item = editor.draft.section.items.find((row) =>
    dialog.mode === "edit" && dialog.stableId
      ? row.stableId === dialog.stableId
      : row.id === submitted.id,
  );
  if (item) {
    const current = projectedItems(editor, dialog).find(
      (row) => row.id === item.id,
    );
    return current ? overviewItemFieldsUnchanged(submitted, current) : false;
  }
  return dialog.mode === "create"
    ? findAcknowledgedItem(editor, dialog) !== undefined
    : false;
}

export function overviewSubmissionIsAcknowledged(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): boolean {
  return (
    findAcknowledgedItem(editor, dialog) !== undefined &&
    overviewSubmittedItemIsCurrent(editor, dialog)
  );
}

export function overviewItemFieldsUnchanged(
  before: KanbanItem,
  current: KanbanItem,
): boolean {
  return authoredFields(before) === authoredFields(current);
}

export function findOverviewDraftItem(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
) {
  if (dialog.mode === "create") return undefined;
  return editor.draft.section.items.find((row) =>
    dialog.stableId
      ? row.stableId === dialog.stableId
      : row.id === dialog.target.recordId,
  );
}

function submissionScopeRecovery(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): string | null {
  if (dialog.generation !== editor.generation)
    return "The report draft changed. Your unsaved input is kept below and has not overwritten the new draft.";
  if (
    dialog.submission &&
    dialog.submission.receiptScope !== editor.draft.receiptScope
  )
    return "The report activation changed. Your unsaved input is kept below and has not overwritten the new draft.";
  return null;
}

function discardedSaveRecovery(dialog: OverviewItemDialogState): string | null {
  return dialog.submission?.discard?.failed
    ? "The restoration was not confirmed. Your unsaved input is kept below. Reload the report before trying again."
    : null;
}

export function overviewEditorRecoveryReason(
  editor: ReadyEditor | null,
  dialog: OverviewItemDialogState | null,
  model: StatusOverviewModel,
): string | null {
  if (!dialog) return null;
  if (!editor || editor.view.viewModel.isReadOnly)
    return "The report is not editable right now. Your unsaved input is kept below.";
  const scopeRecovery = submissionScopeRecovery(editor, dialog);
  if (scopeRecovery) return scopeRecovery;
  if (dialog.submission?.discard) return discardedSaveRecovery(dialog);
  const parent =
    dialog.mode === "create"
      ? { kind: dialog.target.unitKind, id: dialog.target.unitId }
      : (dialog.submission?.item.parent ?? dialog.item.parent);
  if (
    parent.kind === "unresolved" ||
    !model.units.some(
      (unit) =>
        unit.kind === parent.kind && unit.id === parent.id && !unit.historical,
    )
  )
    return "This reporting unit is no longer available. Your unsaved input is kept below.";
  if (dialog.mode === "create")
    return dialog.submission && !overviewSubmittedItemIsCurrent(editor, dialog)
      ? "Your submitted update was not confirmed. It is kept below and has not overwritten the current draft."
      : null;
  return editedItemRecoveryReason(editor, dialog, parent);
}

function editedItemRecoveryReason(
  editor: ReadyEditor,
  dialog: Extract<OverviewItemDialogState, { mode: "edit" }>,
  parent: { readonly kind: "product" | "activity"; readonly id: string },
): string | null {
  const item = findOverviewDraftItem(editor, dialog);
  const expectedWeek = dialog.submission ? dialog.week : dialog.target.source;
  if (item?.type !== expectedWeek)
    return "This update is no longer in the selected week. Your unsaved input is kept below.";
  const parentId = parent.kind === "product" ? item.projectId : item.activityId;
  if (parentId !== parent.id)
    return "This update has moved to another reporting unit. Your unsaved input is kept below.";
  const currentItems =
    expectedWeek === "current"
      ? editor.view.viewModel.ownCurrentWeekItems
      : editor.view.viewModel.ownNextWeekItems;
  const current = currentItems.find((row) => row.id === item.id);
  const submittedReason = submittedEditRecoveryReason(dialog, current);
  if (dialog.submission) return submittedReason;
  const baseline = dialog.promotion?.sourceItem ?? dialog.item;
  if (!current || !overviewItemFieldsUnchanged(baseline, current))
    return "This update changed while you were editing. Your unsaved input is kept below and has not overwritten those changes.";
  return null;
}

function submittedEditRecoveryReason(
  dialog: Extract<OverviewItemDialogState, { mode: "edit" }>,
  current: KanbanItem | undefined,
): string | null {
  return current &&
    dialog.submission &&
    overviewItemFieldsUnchanged(dialog.submission.item, current)
    ? null
    : "Your submitted update was not confirmed. It is kept below and has not overwritten the current draft.";
}
