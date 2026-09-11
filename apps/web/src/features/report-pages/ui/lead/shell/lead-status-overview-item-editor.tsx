import {
  createItemEditDraftStore,
  type DraftPatch,
  type ItemEditDraftStore,
  ItemInlineEditor,
  type KanbanItem,
  ownedStagesForProject,
  type StatusOverviewCreateTarget,
  type StatusOverviewEditTarget,
} from "../../../../report-sections";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface OverviewComposerState {
  readonly generation: string | null;
  readonly draftStore: ItemEditDraftStore;
  readonly editorAtOpen: ReadyEditor;
  readonly submission: OverviewItemSubmission | null;
}

export interface OverviewItemSubmission {
  readonly attempt: number;
  readonly item: KanbanItem;
  readonly inputSnapshot: ReturnType<ItemEditDraftStore["getSnapshot"]>;
  readonly lastSavedAtBefore: Date | null;
  readonly draftVersionBefore: number;
  readonly saveReceiptSequenceBefore: number;
  readonly saveArmed: boolean;
  readonly activityObserved: boolean;
}

interface OverviewEditDialogState extends OverviewComposerState {
  readonly mode: "edit";
  readonly stableId: string | null;
  readonly target: StatusOverviewEditTarget;
  readonly item: KanbanItem;
}

interface OverviewCreateDialogState extends OverviewComposerState {
  readonly mode: "create";
  readonly target: StatusOverviewCreateTarget;
}

export type OverviewItemDialogState =
  OverviewEditDialogState | OverviewCreateDialogState;

export function createOverviewComposerState(
  editor: ReadyEditor,
  target: StatusOverviewCreateTarget | StatusOverviewEditTarget,
  item: KanbanItem | null,
): OverviewComposerState {
  const view = editor.view.viewModel;
  const createTarget = "unitKind" in target ? target : null;
  return {
    generation: editor.generation,
    editorAtOpen: editor,
    submission: null,
    draftStore: createItemEditDraftStore({
      item,
      products: view.products,
      activities: view.activityOptions,
      week: target.source,
      currentUserName: view.currentUser.name,
      defaultProductId:
        createTarget?.unitKind === "product" ? createTarget.unitId : undefined,
      defaultActivityId:
        createTarget?.unitKind === "activity" ? createTarget.unitId : undefined,
    }),
  };
}

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
  saveDisabled = false,
}: {
  readonly editor: ReadyEditor;
  readonly dialog: OverviewItemDialogState;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly saveDisabled?: boolean | undefined;
}) {
  const viewModel = editor.view.viewModel;
  const createTarget = dialog.mode === "create" ? dialog.target : null;
  return (
    <ItemInlineEditor
      key={
        dialog.mode === "edit"
          ? `edit:${dialog.target.source}:${dialog.target.recordId}`
          : `create:${dialog.target.source}:${dialog.target.unitKind}:${dialog.target.unitId}`
      }
      item={dialog.mode === "edit" ? dialog.item : null}
      draftStore={dialog.draftStore}
      saveDisabled={saveDisabled}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      week={dialog.target.source}
      focusNextStep={
        dialog.mode === "edit" && dialog.target.focusNextStep === true
      }
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

export function OverviewInputRecovery({
  dialog,
  reason,
  onCancel,
}: {
  readonly dialog: OverviewItemDialogState;
  readonly reason: string;
  readonly onCancel: () => void;
}) {
  return (
    <section
      aria-label="Unsaved update recovery"
      className="max-w-3xl space-y-3 rounded-[var(--radius)] border border-[var(--color-border-strong)] p-4"
    >
      <p role="alert" className="text-sm text-[var(--color-foreground)]">
        {reason}
      </p>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Copy any text you need before canceling. Saving is disabled until you
        reopen an update from the current draft.
      </p>
      <OverviewItemDialog
        editor={dialog.editorAtOpen}
        dialog={dialog}
        saveDisabled
        onSave={() => undefined}
        onCancel={onCancel}
      />
    </section>
  );
}
