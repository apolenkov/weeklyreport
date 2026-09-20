import type { DraftPatch, KanbanItem } from "../../../../report-sections";
import {
  buildConfirmCarriedItemPatch,
  buildMoveItemPatch,
} from "../../../../report-sections";
import {
  buildStatusOverviewCreatePatch,
  buildStatusOverviewItemPatch,
  findEditableItem,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import {
  findOverviewDraftItem,
  overviewItemFieldsUnchanged,
  overviewSubmittedItemIsCurrent,
} from "./overview-editor-recovery";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type DialogSetter = (
  next:
    | OverviewItemDialogState
    | null
    | ((
        current: OverviewItemDialogState | null,
      ) => OverviewItemDialogState | null),
) => void;

interface SaveContext {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly recoveryReason: string | null;
  readonly setDialog: DialogSetter;
  readonly setError: (error: string | null) => void;
  readonly startedAttempt: { current: number | null };
  readonly promotionAttempt: { current: string | null };
}

function buildLatestOverviewPatch(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  updatedItem: KanbanItem,
) {
  const current = editor.view.viewModel.ownCurrentWeekItems;
  const next = editor.view.viewModel.ownNextWeekItems;
  if (dialog.mode === "create") {
    const submittedId = dialog.submission?.item.id;
    return submittedId
      ? buildStatusOverviewItemPatch(
          { source: dialog.week, recordId: submittedId },
          current,
          next,
          { ...updatedItem, id: submittedId },
        )
      : buildStatusOverviewCreatePatch(
          { ...dialog.target, source: dialog.week },
          current,
          next,
          updatedItem,
        );
  }
  const id = findOverviewDraftItem(editor, dialog)?.id;
  if (!id) return null;
  const source = editor.draft.section.items.find(
    (item) => item.id === id,
  )?.type;
  if (source !== "current" && source !== "next") return null;
  return buildStatusOverviewItemPatch(
    { ...dialog.target, recordId: id, source },
    current,
    next,
    { ...updatedItem, id },
  );
}

function finishPromotion(setDialog: DialogSetter, commandId: string): void {
  setDialog((current) =>
    current?.mode === "edit" && current.promotion?.commandId === commandId
      ? null
      : current,
  );
}

function retainFailedPromotion(
  setDialog: DialogSetter,
  commandId: string,
): void {
  setDialog((current) => {
    if (current?.mode !== "edit" || current.promotion?.commandId !== commandId)
      return current;
    return {
      ...current,
      promotion: { ...current.promotion, pending: false },
    };
  });
}

function submitPromotion(
  context: SaveContext,
  dialog: Extract<OverviewItemDialogState, { mode: "edit" }>,
): void {
  const promotion = dialog.promotion;
  if (!promotion) return;
  if (
    promotion.pending ||
    context.promotionAttempt.current === promotion.commandId
  )
    return;
  const editor = context.editor;
  if (!editor || !dialog.stableId || !editor.outcomes.canExecute) {
    context.setError(
      editor?.outcomes.blockedReason ??
        "The report context changed. Your move has not been saved.",
    );
    return;
  }
  context.promotionAttempt.current = promotion.commandId;
  context.setError(null);
  context.setDialog({
    ...dialog,
    promotion: { ...promotion, pending: true },
  });
  void editor.outcomes
    .promote(
      {
        recordId: dialog.target.recordId,
        commandId: promotion.commandId,
        target: promotion.target,
      },
      dialog.stableId,
    )
    .then(() => finishPromotion(context.setDialog, promotion.commandId))
    .catch((error_: unknown) => {
      context.setError(
        error_ instanceof Error
          ? error_.message
          : "The item could not be moved. Your input is retained; try again.",
      );
      retainFailedPromotion(context.setDialog, promotion.commandId);
    })
    .finally(() => {
      if (context.promotionAttempt.current === promotion.commandId)
        context.promotionAttempt.current = null;
    });
}

// Saving a carried Current item through the canonical editor confirms it for
// the week: the existing confirmation patch clears carriedOver on the same
// draft write, even when the lead changed no other field.
function carriedConfirmPatch(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): DraftPatch | null {
  if (dialog.mode !== "edit") return null;
  const itemId = findOverviewDraftItem(editor, dialog)?.id;
  return itemId
    ? buildConfirmCarriedItemPatch(editor.draft.section, itemId)
    : null;
}

function applyDraftChange(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  submittedItem: KanbanItem,
): string | null {
  const currentItem =
    dialog.mode === "edit" ? findOverviewDraftItem(editor, dialog) : null;
  const itemId = currentItem?.id ?? null;
  const confirmPatch = carriedConfirmPatch(editor, dialog);
  const moving = dialog.mode === "edit" && currentItem?.type !== dialog.week;
  const movePatch =
    moving && itemId
      ? buildMoveItemPatch(editor.draft.section, itemId, dialog.week)
      : null;
  if (moving && !movePatch)
    return "This item cannot be moved to the selected week. Your changes are still here.";
  const patch = buildLatestOverviewPatch(editor, dialog, submittedItem);
  if (!patch)
    return "This update is no longer available. Your text has not been discarded.";
  editor.draft.apply(patch);
  if (confirmPatch) editor.draft.apply(confirmPatch);
  if (movePatch) editor.draft.apply(movePatch);
  return null;
}

function armDraftSave(
  context: SaveContext,
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  submittedItem: KanbanItem,
): void {
  context.setError(null);
  context.setDialog({
    ...dialog,
    submission: {
      attempt: (dialog.submission?.attempt ?? 0) + 1,
      item: submittedItem,
      inputSnapshot: dialog.draftStore.getSnapshot(),
      lastSavedAtBefore: editor.draft.autosave.lastSavedAt,
      draftVersionBefore: editor.draft.version,
      saveReceiptSequenceBefore: editor.draft.lastSaveReceipt?.sequence ?? 0,
      saveArmed: false,
      activityObserved: false,
    },
  });
}

function submitDraftUpdate(
  context: SaveContext,
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  updatedItem: KanbanItem,
): void {
  const retrying =
    dialog.submission !== null &&
    overviewSubmittedItemIsCurrent(editor, dialog) &&
    overviewItemFieldsUnchanged(dialog.submission.item, updatedItem);
  const submittedItem =
    dialog.mode === "create" && dialog.submission
      ? { ...updatedItem, id: dialog.submission.item.id }
      : updatedItem;
  const error = retrying
    ? null
    : applyDraftChange(editor, dialog, submittedItem);
  if (error) {
    context.setError(error);
    return;
  }
  armDraftSave(context, editor, dialog, submittedItem);
}

export function saveOverviewItem(
  context: SaveContext,
  updatedItem: KanbanItem,
): void {
  const { dialog, editor } = context;
  if (!editor || !dialog || context.isReadOnly) return;
  if (context.recoveryReason) {
    context.setError(context.recoveryReason);
    return;
  }
  if (dialog.mode === "edit" && dialog.promotion) {
    submitPromotion(context, dialog);
    return;
  }
  const unchanged =
    dialog.mode === "edit" &&
    dialog.submission === null &&
    dialog.week === dialog.target.source &&
    overviewItemFieldsUnchanged(dialog.item, updatedItem);
  // A carried item still writes on Save: the confirmation patch that clears
  // carriedOver must ride along even when no field changed.
  if (unchanged && carriedConfirmPatch(editor, dialog) === null) {
    context.startedAttempt.current = null;
    context.setDialog(null);
    context.setError(null);
    return;
  }
  submitDraftUpdate(context, editor, dialog, updatedItem);
}

export function overviewMoveEditorItem(
  editor: ReadyEditor,
  item: {
    readonly text: string;
    readonly editTarget: NonNullable<Parameters<typeof findEditableItem>[1]>;
  },
  target: "current" | "next",
): { readonly item?: KanbanItem; readonly promotion?: "current" | "next" } {
  const sourceRecord = editor.draft.section.items.find(
    (row) => row.id === item.editTarget.recordId,
  );
  const sourceItem = findEditableItem(editor, item.editTarget);
  if (!sourceRecord || !sourceItem) return {};
  if (item.editTarget.focusNextStep && target === "current") {
    return {
      item: { ...sourceItem, text: item.text, nextStepText: null },
      promotion: target,
    };
  }
  if (
    target === "next" &&
    sourceRecord.type === "current" &&
    sourceRecord.nextStepText?.trim()
  ) {
    return {
      item: {
        ...sourceItem,
        text: sourceRecord.nextStepText,
        nextStepText: null,
      },
      promotion: target,
    };
  }
  return {};
}
