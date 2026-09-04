import {
  type DraftPatch,
  ItemEditDialog,
  type KanbanItem,
  ownedStagesForProject,
  type StatusOverviewCreateTarget,
  type StatusOverviewEditTarget,
} from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface OverviewEditDialogState {
  readonly mode: "edit";
  readonly generation: string | null;
  readonly target: StatusOverviewEditTarget;
  readonly item: KanbanItem;
}

interface OverviewCreateDialogState {
  readonly mode: "create";
  readonly generation: string | null;
  readonly target: StatusOverviewCreateTarget;
}

export type OverviewItemDialogState =
  OverviewEditDialogState | OverviewCreateDialogState;

export function buildStatusOverviewItemPatch(
  target: StatusOverviewEditTarget,
  currentItems: readonly KanbanItem[],
  nextItems: readonly KanbanItem[],
  updatedItem: KanbanItem,
): DraftPatch | null {
  const sourceItems = target.source === "current" ? currentItems : nextItems;
  if (!sourceItems.some((item) => item.id === target.recordId)) return null;
  return {
    kind: "week-items",
    week: target.source,
    items: sourceItems.map((item) =>
      item.id === target.recordId ? updatedItem : item,
    ),
  };
}

export function buildStatusOverviewCreatePatch(
  target: StatusOverviewCreateTarget,
  currentItems: readonly KanbanItem[],
  nextItems: readonly KanbanItem[],
  createdItem: KanbanItem,
): DraftPatch {
  const sourceItems = target.source === "current" ? currentItems : nextItems;
  return {
    kind: "week-items",
    week: target.source,
    items: [...sourceItems, createdItem],
  };
}

export function findEditableItem(
  editor: ReadyEditor,
  target: StatusOverviewEditTarget,
): KanbanItem | null {
  const items =
    target.source === "current"
      ? editor.view.viewModel.ownCurrentWeekItems
      : editor.view.viewModel.ownNextWeekItems;
  return items.find((item) => item.id === target.recordId) ?? null;
}

export function OverviewItemDialog({
  editor,
  dialog,
  onSave,
  onCancel,
}: {
  readonly editor: ReadyEditor;
  readonly dialog: OverviewItemDialogState;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
}) {
  const viewModel = editor.view.viewModel;
  const createTarget = dialog.mode === "create" ? dialog.target : null;
  return (
    <ItemEditDialog
      key={
        dialog.mode === "edit"
          ? `edit:${dialog.target.source}:${dialog.target.recordId}`
          : `create:${dialog.target.source}:${dialog.target.unitKind}:${dialog.target.unitId}`
      }
      open
      item={dialog.mode === "edit" ? dialog.item : null}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      week={dialog.target.source}
      currentUserName={viewModel.currentUser.name}
      defaultProductId={
        createTarget?.unitKind === "product" ? createTarget.unitId : undefined
      }
      defaultActivityId={
        createTarget?.unitKind === "activity" ? createTarget.unitId : undefined
      }
      stagesForProduct={(productId) =>
        ownedStagesForProject(editor.draft.section, productId)
      }
      ownPeriodRanks={viewModel.ownPeriodRanks}
      risks={viewModel.ownRisks}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}
