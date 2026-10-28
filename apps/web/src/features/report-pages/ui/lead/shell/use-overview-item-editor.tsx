import type { LeadStatusOverviewOutput } from "@weeklyreport/shared";
import { useEffect, useRef, useState } from "react";

import type {
  KanbanItem,
  StatusOverviewEditorSlot,
  StatusOverviewModel,
} from "../../../../report-sections";
import {
  OverviewEditorDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { overviewEditorRecoveryReason } from "./overview-editor-recovery";
import { useRetainedOverviewState } from "./overview-input-provider";
import { saveOverviewItem } from "./overview-item-save";
import {
  closeOverviewDialog,
  driveOverviewSubmission,
  overviewSaveFailure,
} from "./overview-item-submission";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";
import {
  useOverviewCreateOpeners,
  useOverviewEditOpeners,
} from "./use-overview-openers";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function useOverviewItemEditor(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  reportId: string,
  output?: LeadStatusOverviewOutput,
) {
  const isReadOnly = editor?.view.viewModel.isReadOnly ?? true;
  const [dialog, setDialog] = useRetainedOverviewState("item", reportId);
  const [error, setError] = useState<string | null>(null);
  const recoveryReason = overviewEditorRecoveryReason(editor, dialog, model);
  const startedAttempt = useRef<number | null>(null);
  const promotionAttempt = useRef<string | null>(null);
  const rememberFocus = useOverviewFocusReturn(dialog !== null);

  useEffect(() => {
    driveOverviewSubmission({
      editor,
      dialog,
      recoveryReason,
      setDialog,
      startedAttempt,
    });
  }, [dialog, editor, recoveryReason, setDialog]);
  const openers = {
    editor,
    model,
    output,
    dialog,
    isReadOnly,
    setDialog,
    rememberFocus,
    resetAttempt: () => {
      startedAttempt.current = null;
    },
  };
  const { editItem, moveItem, confirmItem, setItemStatus } =
    useOverviewEditOpeners(openers);
  const { addItem, planItem } = useOverviewCreateOpeners(openers);
  const saveContext = {
    editor,
    dialog,
    isReadOnly,
    recoveryReason,
    setDialog,
    setError,
    startedAttempt,
    promotionAttempt,
  };
  const saveAndAddAnother =
    dialog?.mode === "create"
      ? (updatedItem: KanbanItem): void =>
          saveOverviewItem(saveContext, updatedItem, { addAnother: true })
      : undefined;
  return {
    dialog,
    error: error ?? overviewSaveFailure(editor, dialog),
    recoveryReason,
    editItem,
    addItem,
    planItem,
    moveItem,
    confirmItem,
    setItemStatus,
    changeWeek: (week: "current" | "next") =>
      setDialog((current) =>
        current?.submission === null ? { ...current, week } : current,
      ),
    save: (updatedItem: KanbanItem) =>
      saveOverviewItem(saveContext, updatedItem),
    saveAndAddAnother,
    close: () => {
      closeOverviewDialog({ editor, dialog, recoveryReason, setDialog });
      startedAttempt.current = null;
      promotionAttempt.current = null;
      setError(null);
    },
  };
}

export function buildOverviewEditorSlot(
  editor: ReadyEditor | null,
  editing: OverviewItemDialogState | null,
  {
    onSave,
    onSaveAndAddAnother,
    onCancel,
    onWeekChange,
  }: {
    onSave: (item: KanbanItem) => void;
    onSaveAndAddAnother?: ((item: KanbanItem) => void) | undefined;
    onCancel: () => void;
    onWeekChange: (week: "current" | "next") => void;
  },
): StatusOverviewEditorSlot | undefined {
  if (!editor || !editing || editor.view.viewModel.isReadOnly) return undefined;
  if (editing.generation !== editor.generation) return undefined;
  const parent =
    editing.mode === "create"
      ? { kind: editing.target.unitKind, id: editing.target.unitId }
      : (editing.submission?.item.parent ?? editing.item.parent);
  if (parent.kind === "unresolved") return undefined;
  return {
    mode: editing.mode,
    unitKey: `${parent.kind}:${parent.id}`,
    source: editing.week,
    recordId: editing.mode === "edit" ? editing.target.recordId : null,
    stableId: editing.stableId,
    content: (
      <OverviewEditorDialog
        editor={editor}
        dialog={editing}
        isReadOnly={false}
        saveDisabled={
          editing.submission?.discard != null ||
          (editing.mode === "edit" && editing.promotion?.pending === true) ||
          (editing.submission !== null &&
            editor.draft.autosave.state !== "error" &&
            (editor.draft.autosave.dirty ||
              editor.draft.autosave.isInFlight ||
              editor.draft.autosave.state === "pending" ||
              editor.draft.autosave.state === "saving"))
        }
        onSave={onSave}
        onSaveAndAddAnother={onSaveAndAddAnother}
        onCancel={onCancel}
        onWeekChange={onWeekChange}
      />
    ),
  };
}
