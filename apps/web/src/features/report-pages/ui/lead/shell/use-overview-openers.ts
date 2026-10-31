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
import { moveWithoutEditor, type WhenIdle } from "./overview-in-place-move";
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
  readonly focusMoved: (identity: string | null) => void;
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
    readonly promotionTarget: "current" | undefined;
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

// A running outcome command locks the draft: apply right after it.
function applyCarriedConfirmation(
  whenIdle: WhenIdle,
  item: StatusOverviewItem,
): void {
  const recordId = item.recordId;
  if (!recordId) return;
  whenIdle((ready) => {
    const patch = buildConfirmCarriedItemPatch(ready.draft.section, recordId);
    if (patch) ready.draft.apply(patch);
  });
}

// The canonical editor path for a move: the move may swap the visible item
// (a promoted next step) and always carries the focus-return key.
function moveEditorOptions(
  editor: ReadyEditor,
  item: Parameters<typeof overviewMoveEditorItem>[1],
  target: "current" | "next",
  focusKey: string | undefined,
) {
  const move = overviewMoveEditorItem(editor, item, target);
  return {
    visibleItem: move.item,
    promotionTarget: move.promotion,
    focusKey,
  };
}

export function useOverviewEditOpeners({
  editor,
  dialog,
  isReadOnly,
  setDialog,
  rememberFocus,
  focusMoved,
  resetAttempt,
}: OpenersArgs) {
  const { whenIdle } = useEditorSettle(editor);
  const saveStatus = useOverviewStatusSave(editor);
  const openEditItem = (
    target: StatusOverviewEditTarget,
    week: "current" | "next",
    options: {
      visibleItem?: KanbanItem | undefined;
      promotionTarget?: "current" | undefined;
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
    const { editTarget } = item;
    if (!editor || isReadOnly || dialog || !editTarget) return;
    const section = editor.draft.section;
    if (moveWithoutEditor({ whenIdle, focusMoved, section, item, target }))
      return;
    const move = { text: item.text, editTarget };
    openEditItem(
      editTarget,
      target,
      moveEditorOptions(editor, move, target, focusKey),
    );
  };
  const confirmItem = (item: StatusOverviewItem): void => {
    if (!editor || isReadOnly || dialog) return;
    applyCarriedConfirmation(whenIdle, item);
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
