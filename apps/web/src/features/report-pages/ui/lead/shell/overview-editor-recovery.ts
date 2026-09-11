import type {
  KanbanItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

function authoredFields(item: KanbanItem) {
  return JSON.stringify({
    text: item.text,
    nextStepText: item.nextStepText ?? null,
    status: item.status,
    parent: item.parent,
    stageNames: item.stageNames,
    priorityRank: item.priorityRank ?? null,
    pausedReason: item.pausedReason ?? null,
  });
}

function projectedItems(editor: ReadyEditor, dialog: OverviewItemDialogState) {
  return dialog.target.source === "current"
    ? editor.view.viewModel.ownCurrentWeekItems
    : editor.view.viewModel.ownNextWeekItems;
}

function submissionSaveWasAcknowledged(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): boolean {
  const submission = dialog.submission;
  return Boolean(
    submission?.saveArmed &&
    dialog.generation === editor.generation &&
    editor.draft.version > submission.draftVersionBefore &&
    editor.draft.autosave.lastSavedAt !== null &&
    editor.draft.autosave.lastSavedAt !== submission.lastSavedAtBefore,
  );
}

function findAcknowledgedCreatedItem(
  editor: ReadyEditor,
  dialog: Extract<OverviewItemDialogState, { mode: "create" }>,
): KanbanItem | undefined {
  const submission = dialog.submission;
  const receipt = editor.draft.lastSaveReceipt;
  if (
    !submission?.saveArmed ||
    !receipt ||
    dialog.generation !== editor.generation ||
    receipt.sequence <= submission.saveReceiptSequenceBefore ||
    receipt.generation !== dialog.generation ||
    receipt.reportSectionId !== editor.draft.section.reportSectionId ||
    receipt.version <= submission.draftVersionBefore
  ) {
    return undefined;
  }
  const identity = receipt.itemIdentities.find(
    (candidate) => candidate.clientId === submission.item.id,
  );
  if (!identity?.stableId) return undefined;
  const persisted = editor.draft.section.items.find(
    (row) => row.id === identity.serverId,
  );
  if (persisted?.stableId?.localeCompare(identity.stableId) !== 0)
    return undefined;
  const current = projectedItems(editor, dialog).find(
    (row) => row.id === identity.serverId,
  );
  return current && overviewItemFieldsUnchanged(submission.item, current)
    ? current
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
    ? findAcknowledgedCreatedItem(editor, dialog) !== undefined
    : false;
}

export function overviewSubmissionIsAcknowledged(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): boolean {
  return dialog.mode === "create"
    ? findAcknowledgedCreatedItem(editor, dialog) !== undefined
    : submissionSaveWasAcknowledged(editor, dialog) &&
        overviewSubmittedItemIsCurrent(editor, dialog);
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

export function overviewEditorRecoveryReason(
  editor: ReadyEditor | null,
  dialog: OverviewItemDialogState | null,
  model: StatusOverviewModel,
): string | null {
  if (!dialog) return null;
  if (!editor || editor.view.viewModel.isReadOnly)
    return "The report is not editable right now. Your unsaved input is kept below.";
  if (dialog.generation !== editor.generation)
    return "The report draft changed. Your unsaved input is kept below and has not overwritten the new draft.";
  const parent =
    dialog.mode === "create"
      ? { kind: dialog.target.unitKind, id: dialog.target.unitId }
      : dialog.item.parent;
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
  if (item?.type !== dialog.target.source)
    return "This update is no longer in the selected week. Your unsaved input is kept below.";
  const parentId = parent.kind === "product" ? item.projectId : item.activityId;
  if (parentId !== parent.id)
    return "This update has moved to another reporting unit. Your unsaved input is kept below.";
  const currentItems =
    dialog.target.source === "current"
      ? editor.view.viewModel.ownCurrentWeekItems
      : editor.view.viewModel.ownNextWeekItems;
  const current = currentItems.find((row) => row.id === item.id);
  const submittedReason = submittedEditRecoveryReason(dialog, current);
  if (dialog.submission) return submittedReason;
  if (dialog.target.focusNextStep && !item.nextStepText?.trim())
    return "The next step was removed from the draft. Your unsaved input is kept below.";
  if (!current || !overviewItemFieldsUnchanged(dialog.item, current))
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
