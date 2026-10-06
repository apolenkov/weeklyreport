import type {
  ItemWorkflowStatus,
  LeadStatusOverviewOutput,
} from "@customreport/shared";
import type { SetStateAction } from "react";

import type {
  KanbanItem,
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import {
  buildConfirmCarriedItemPatch,
  buildSetItemStatusPatch,
} from "../../../../report-sections";
import {
  createOverviewComposerState,
  findEditableItem,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import { buildPriorPlanSeed } from "./overview-editor-recovery";
import { overviewMoveEditorItem } from "./overview-item-save";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

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
    if (!editor || isReadOnly || dialog || !item.recordId) return;
    const patch = buildConfirmCarriedItemPatch(
      editor.draft.section,
      item.recordId,
    );
    if (patch) editor.draft.apply(patch);
  };
  // A status the draft can take directly is patched in place; one that needs
  // more input (a pause reason, a next step to clear, a covering risk) opens
  // the canonical editor on the same item instead.
  const setItemStatus = (
    item: StatusOverviewItem,
    status: ItemWorkflowStatus,
    focusKey?: string,
  ): void => {
    if (!editor || isReadOnly || dialog || !item.recordId || !item.editTarget)
      return;
    const patch = buildSetItemStatusPatch(
      editor.draft.section,
      item.recordId,
      status,
    );
    if (patch) editor.draft.apply(patch);
    else openEditItem(item.editTarget, item.editTarget.source, { focusKey });
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
