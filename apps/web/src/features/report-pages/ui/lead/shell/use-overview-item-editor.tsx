import type { LeadStatusOverviewOutput } from "@customreport/shared";
import { useEffect, useRef, useState } from "react";

import type {
  KanbanItem,
  StatusOverviewCreateTarget,
  StatusOverviewEditorSlot,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import { buildConfirmCarriedItemPatch } from "../../../../report-sections";
import {
  createOverviewComposerState,
  findEditableItem,
  OverviewEditorDialog,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import {
  buildPriorPlanSeed,
  overviewEditorRecoveryReason,
  overviewSubmissionIsAcknowledged,
} from "./overview-editor-recovery";
import { useRetainedOverviewState } from "./overview-input-provider";
import { overviewMoveEditorItem, saveOverviewItem } from "./overview-item-save";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewFocusReturn } from "./use-overview-focus-return";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

export function useOverviewItemEditor(
  editor: ReadyEditor | null,
  isReadOnly: boolean,
  model: StatusOverviewModel,
  reportId: string,
  output?: LeadStatusOverviewOutput,
) {
  const [dialog, setDialog] = useRetainedOverviewState("item", reportId);
  const [error, setError] = useState<string | null>(null);
  const recoveryReason = overviewEditorRecoveryReason(editor, dialog, model);
  const startedAttempt = useRef<number | null>(null);
  const promotionAttempt = useRef<string | null>(null);
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
  const openEditItem = (
    target: StatusOverviewEditTarget,
    week: "current" | "next",
    visibleItem?: KanbanItem,
    promotionTarget?: "current" | "next",
    focusKey?: string,
  ): void => {
    if (!editor || isReadOnly || dialog) return;
    const item = findEditableItem(editor, target);
    if (!item) return;
    const sourceRecord = editor.draft.section.items.find(
      (row) => row.id === item.id,
    );
    const sourceItem = sourceRecord
      ? { ...item, nextStepText: sourceRecord.nextStepText ?? null }
      : item;
    rememberFocus(focusKey);
    startedAttempt.current = null;
    const dialogItem = visibleItem ?? item;
    setDialog({
      ...createOverviewComposerState(editor, target, dialogItem),
      week,
      mode: "edit",
      stableId:
        editor.draft.section.items.find((row) => row.id === item.id)
          ?.stableId ?? null,
      target,
      item: dialogItem,
      ...(promotionTarget
        ? {
            promotion: {
              target: promotionTarget,
              commandId: crypto.randomUUID(),
              sourceItem,
              pending: false,
            },
          }
        : {}),
    });
  };
  const editItem = (target: StatusOverviewEditTarget): void => {
    openEditItem(target, target.source);
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
  const planItem = (item: StatusOverviewItem): void => {
    if (
      !editor ||
      isReadOnly ||
      dialog ||
      !item.canResolve ||
      item.source !== "previous"
    )
      return;
    const planned = buildPriorPlanSeed(
      output,
      editor.draft.section,
      model,
      item,
    );
    if (!planned) return;
    rememberFocus();
    startedAttempt.current = null;
    setDialog({
      ...createOverviewComposerState(editor, planned.target, planned.seed),
      mode: "create",
      target: planned.target,
    });
  };
  const save = (updatedItem: KanbanItem): void => {
    saveOverviewItem(
      {
        editor,
        dialog,
        isReadOnly,
        recoveryReason,
        setDialog,
        setError,
        startedAttempt,
        promotionAttempt,
      },
      updatedItem,
    );
  };
  const moveItem = (
    item: StatusOverviewItem,
    target: "current" | "next",
    focusKey?: string,
  ): void => {
    if (!editor || isReadOnly || dialog || !item.editTarget) return;
    const move = overviewMoveEditorItem(
      editor,
      { text: item.text, editTarget: item.editTarget },
      target,
    );
    openEditItem(item.editTarget, target, move.item, move.promotion, focusKey);
  };
  const confirmItem = (item: StatusOverviewItem): void => {
    if (!editor || isReadOnly || dialog || !item.recordId) return;
    const patch = buildConfirmCarriedItemPatch(
      editor.draft.section,
      item.recordId,
    );
    if (patch) editor.draft.apply(patch);
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
    planItem,
    moveItem,
    confirmItem,
    changeWeek: (week: "current" | "next") =>
      setDialog((current) =>
        current?.submission === null ? { ...current, week } : current,
      ),
    save,
    close: () => {
      startedAttempt.current = null;
      promotionAttempt.current = null;
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
  onWeekChange: (week: "current" | "next") => void,
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
          (editing.mode === "edit" && editing.promotion?.pending === true) ||
          (editing.submission !== null &&
            editor.draft.autosave.state !== "error" &&
            (editor.draft.autosave.dirty ||
              editor.draft.autosave.isInFlight ||
              editor.draft.autosave.state === "pending" ||
              editor.draft.autosave.state === "saving"))
        }
        onSave={onSave}
        onCancel={onCancel}
        onWeekChange={onWeekChange}
      />
    ),
  };
}
