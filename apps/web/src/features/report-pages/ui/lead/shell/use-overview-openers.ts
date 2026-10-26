import type { LeadStatusOverviewOutput } from "@weeklyreport/shared";
import type { SetStateAction } from "react";

import type {
  KanbanItem,
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import { buildConfirmCarriedItemPatch } from "../../../../report-sections";
import {
  createOverviewComposerState,
  findEditableItem,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { buildPriorPlanSeed } from "./overview-editor-recovery";
import { overviewMoveEditorItem } from "./overview-item-save";
import { useEditorSettle } from "./use-editor-settle";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import { useOverviewStatusSave } from "./use-overview-status-save";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface OpenersArgs {
  readonly editor: ReadyEditor | null;
  readonly model: StatusOverviewModel;
  readonly output?: LeadStatusOverviewOutput | undefined;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly setDialog: (
    action: SetStateAction<OverviewItemDialogState | null>,
  ) => void;
  readonly rememberFocus: (explicitOriginKey?: string) => void;
  readonly resetAttempt: () => void;
}

function editDialogState(
  editor: ReadyEditor,
  {
    target,
    week,
    item,
    dialogItem,
    promotionTarget,
  }: {
    readonly target: StatusOverviewEditTarget;
    readonly week: "current" | "next";
    readonly item: KanbanItem;
    readonly dialogItem: KanbanItem;
    readonly promotionTarget: "current" | "next" | undefined;
  },
): OverviewItemDialogState {
  const sourceRecord = editor.draft.section.items.find(
    (row) => row.id === item.id,
  );
  const sourceItem = sourceRecord
    ? { ...item, nextStepText: sourceRecord.nextStepText ?? null }
    : item;
  return {
    ...createOverviewComposerState(editor, target, dialogItem),
    week,
    mode: "edit",
    stableId: sourceRecord?.stableId ?? null,
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
  };
}

export function useOverviewEditOpeners({
  editor,
  dialog,
  isReadOnly,
  setDialog,
  rememberFocus,
  resetAttempt,
}: OpenersArgs) {
  const { whenIdle } = useEditorSettle(editor);
  const saveStatus = useOverviewStatusSave(editor);
  const openEditItem = (
    target: StatusOverviewEditTarget,
    week: "current" | "next",
    options: {
      visibleItem?: KanbanItem | undefined;
      promotionTarget?: "current" | "next" | undefined;
      focusKey?: string | undefined;
    } = {},
  ): void => {
    const { visibleItem, promotionTarget, focusKey } = options;
    if (!editor || isReadOnly || dialog) return;
    const item = findEditableItem(editor, target);
    if (!item) return;
    rememberFocus(focusKey);
    resetAttempt();
    setDialog(
      editDialogState(editor, {
        target,
        week,
        item,
        dialogItem: visibleItem ?? item,
        promotionTarget,
      }),
    );
  };
  const editItem = (target: StatusOverviewEditTarget): void => {
    openEditItem(target, target.source);
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
    openEditItem(item.editTarget, target, {
      visibleItem: move.item,
      promotionTarget: move.promotion,
      focusKey,
    });
  };
  const confirmItem = (item: StatusOverviewItem): void => {
    const recordId = item.recordId;
    if (!editor || isReadOnly || dialog || !recordId) return;
    // A running outcome command locks the draft: apply right after it.
    whenIdle((ready) => {
      const patch = buildConfirmCarriedItemPatch(ready.draft.section, recordId);
      if (patch) ready.draft.apply(patch);
    });
  };
  const setItemStatus = (
    item: StatusOverviewItem,
    status: Parameters<typeof saveStatus>[1],
    _focusKey?: string,
    input: Parameters<typeof saveStatus>[2] = {},
  ): Promise<string | null> => {
    if (!editor || isReadOnly || dialog || !item.recordId || !item.editTarget)
      return Promise.resolve("This report is not editable right now.");
    return saveStatus(item, status, input);
  };
  return { editItem, moveItem, confirmItem, setItemStatus };
}

export function useOverviewCreateOpeners({
  editor,
  model,
  output,
  dialog,
  isReadOnly,
  setDialog,
  rememberFocus,
  resetAttempt,
}: OpenersArgs) {
  const addItem = (target: StatusOverviewCreateTarget): void => {
    if (!editor || isReadOnly || dialog) return;
    const unit = model.units.find(
      (candidate) =>
        candidate.kind === target.unitKind && candidate.id === target.unitId,
    );
    if (!unit || unit.historical) return;
    rememberFocus();
    resetAttempt();
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
    resetAttempt();
    setDialog({
      ...createOverviewComposerState(editor, planned.target, planned.seed),
      mode: "create",
      target: planned.target,
    });
  };
  return { addItem, planItem };
}
