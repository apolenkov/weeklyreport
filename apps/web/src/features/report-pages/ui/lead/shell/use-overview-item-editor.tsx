import { useEffect, useRef, useState } from "react";

import type {
  KanbanItem,
  StatusOverviewCreateTarget,
  StatusOverviewEditorSlot,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import {
  buildStatusOverviewCreatePatch,
  buildStatusOverviewItemPatch,
  createOverviewComposerState,
  findEditableItem,
  OverviewItemDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import {
  findOverviewDraftItem,
  overviewEditorRecoveryReason,
  overviewItemFieldsUnchanged,
  overviewSubmissionIsAcknowledged,
  overviewSubmittedItemIsCurrent,
} from "./overview-editor-recovery";
import { useRetainedOverviewState } from "./overview-input-provider";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

function OverviewEditorDialog({
  editor,
  dialog,
  isReadOnly,
  saveDisabled,
  onSave,
  onCancel,
}: {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly saveDisabled: boolean;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
}) {
  if (!editor || !dialog || isReadOnly) return null;
  if (dialog.generation !== editor.generation) return null;
  return (
    <fieldset disabled={saveDisabled} className="min-w-0 border-0 p-0">
      <OverviewItemDialog
        editor={editor}
        dialog={dialog}
        saveDisabled={saveDisabled}
        onSave={onSave}
        onCancel={onCancel}
      />
    </fieldset>
  );
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
    if (submittedId) {
      return buildStatusOverviewItemPatch(
        { source: dialog.target.source, recordId: submittedId },
        current,
        next,
        { ...updatedItem, id: submittedId },
      );
    }
    return buildStatusOverviewCreatePatch(
      dialog.target,
      current,
      next,
      updatedItem,
    );
  }
  const id = findOverviewDraftItem(editor, dialog)?.id;
  if (!id) return null;
  return buildStatusOverviewItemPatch(
    { ...dialog.target, recordId: id },
    current,
    next,
    { ...updatedItem, id },
  );
}

export function useOverviewItemEditor(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
  model: StatusOverviewModel,
  reportId: string,
) {
  const [dialog, setDialog] = useRetainedOverviewState("item", reportId);
  const [error, setError] = useState<string | null>(null);
  const recoveryReason = overviewEditorRecoveryReason(editor, dialog, model);
  const startedAttempt = useRef<number | null>(null);
  const rememberFocus = useOverviewFocusReturn(dialog !== null);

  useEffect(() => {
    const submission = dialog?.submission;
    if (!editor || !dialog || !submission) return;
    if (!submission.saveArmed) {
      setDialog((current) =>
        current?.submission?.attempt === submission.attempt
          ? {
              ...current,
              submission: { ...current.submission, saveArmed: true },
            }
          : current,
      );
      return;
    }
    const autosave = editor.draft.autosave;
    const active =
      autosave.dirty ||
      autosave.isInFlight ||
      autosave.state === "pending" ||
      autosave.state === "saving" ||
      autosave.state === "error";
    if (active && !submission.activityObserved) {
      setDialog((current) =>
        current?.submission?.attempt === submission.attempt
          ? {
              ...current,
              submission: { ...current.submission, activityObserved: true },
            }
          : current,
      );
    }
    if (!recoveryReason && startedAttempt.current !== submission.attempt) {
      startedAttempt.current = submission.attempt;
      const attempt = submission.attempt;
      queueMicrotask(() => {
        if (startedAttempt.current === attempt) void editor.draft.save();
      });
    }
    const acknowledged =
      startedAttempt.current === submission.attempt &&
      autosave.state !== "error" &&
      !recoveryReason &&
      overviewSubmissionIsAcknowledged(editor, dialog);
    if (acknowledged) {
      startedAttempt.current = null;
      setDialog((current) =>
        current?.submission?.attempt === submission.attempt ? null : current,
      );
    }
  }, [dialog, editor, recoveryReason, setDialog]);
  const editItem = (target: StatusOverviewEditTarget): void => {
    if (!editor || isReadOnly || dialog) return;
    const item = findEditableItem(editor, target);
    if (!item) return;
    rememberFocus();
    startedAttempt.current = null;
    setDialog({
      ...createOverviewComposerState(editor, target, item),
      mode: "edit",
      stableId:
        editor.draft.section.items.find((row) => row.id === item.id)
          ?.stableId ?? null,
      target,
      item,
    });
  };
  const addItem = (target: StatusOverviewCreateTarget): void => {
    if (!editor || isReadOnly || dialog) return;
    const unit = model.units.find(
      (candidate) =>
        candidate.kind === target.unitKind && candidate.id === target.unitId,
    );
    if (!unit || unit.historical) return;
    rememberFocus();
    startedAttempt.current = null;
    setDialog({
      ...createOverviewComposerState(editor, target, null),
      mode: "create",
      target,
    });
  };
  const save = (updatedItem: KanbanItem): void => {
    if (!editor || !dialog || isReadOnly) return;
    if (recoveryReason) {
      setError(recoveryReason);
      return;
    }
    if (
      dialog.mode === "edit" &&
      dialog.submission === null &&
      overviewItemFieldsUnchanged(dialog.item, updatedItem)
    ) {
      startedAttempt.current = null;
      setDialog(null);
      setError(null);
      return;
    }
    const retryingRetainedSubmission =
      dialog.submission !== null &&
      overviewSubmittedItemIsCurrent(editor, dialog) &&
      overviewItemFieldsUnchanged(dialog.submission.item, updatedItem);
    const submittedItem =
      dialog.mode === "create" && dialog.submission
        ? { ...updatedItem, id: dialog.submission.item.id }
        : updatedItem;
    if (!retryingRetainedSubmission) {
      const patch = buildLatestOverviewPatch(editor, dialog, submittedItem);
      if (!patch) {
        setError(
          "This update is no longer available. Your text has not been discarded.",
        );
        return;
      }
      editor.draft.apply(patch);
    }
    setError(null);
    setDialog({
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
  };
  const quickEditText = (item: StatusOverviewItem, text: string): void => {
    if (!editor || isReadOnly) return;
    const itemId = item.recordId ?? item.stableId ?? item.key;
    editor.draft.apply({ kind: "item-patch", itemId, patch: { text } });
  };
  return {
    dialog,
    error:
      error ??
      (dialog?.submission && editor?.draft.autosave.state === "error"
        ? "Save failed. Your update is still here; try saving again."
        : null),
    recoveryReason,
    editItem,
    addItem,
    quickEditText,
    save,
    close: () => {
      startedAttempt.current = null;
      setDialog(null);
      setError(null);
    },
  };
}

export function buildOverviewEditorSlot(
  editor: ReadyEditor | null,
  editing: OverviewItemDialogState | null,
  onSave: (item: KanbanItem) => void,
  onCancel: () => void,
): StatusOverviewEditorSlot | undefined {
  if (!editor || !editing || editor.view.viewModel.isReadOnly) return undefined;
  if (editing.generation !== editor.generation) return undefined;
  const parent =
    editing.mode === "create"
      ? { kind: editing.target.unitKind, id: editing.target.unitId }
      : editing.item.parent;
  if (parent.kind === "unresolved") return undefined;
  return {
    unitKey: `${parent.kind}:${parent.id}`,
    source:
      editing.mode === "edit" && editing.target.focusNextStep
        ? "next"
        : editing.target.source,
    recordId: editing.mode === "edit" ? editing.target.recordId : null,
    stableId: editing.mode === "edit" ? editing.stableId : null,
    content: (
      <OverviewEditorDialog
        editor={editor}
        dialog={editing}
        isReadOnly={false}
        saveDisabled={
          editing.submission !== null &&
          editor.draft.autosave.state !== "error" &&
          (editor.draft.autosave.dirty ||
            editor.draft.autosave.isInFlight ||
            editor.draft.autosave.state === "pending" ||
            editor.draft.autosave.state === "saving")
        }
        onSave={onSave}
        onCancel={onCancel}
      />
    ),
  };
}
