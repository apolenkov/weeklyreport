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
  readonly stableId: string | null;
  readonly week: "current" | "next";
  readonly draftStore: ItemEditDraftStore;
  readonly editorAtOpen: ReadyEditor;
  readonly submission: OverviewItemSubmission | null;
}

interface OverviewItemSubmission {
  readonly attempt: number;
  readonly item: KanbanItem;
  readonly inputSnapshot: ReturnType<ItemEditDraftStore["getSnapshot"]>;
  readonly lastSavedAtBefore: Date | null;
  readonly draftVersionBefore: number;
  readonly saveReceiptSequenceBefore: number;
  readonly saveArmed: boolean;
  readonly activityObserved: boolean;
  // The edited row as it was before the first Save applied it, so abandoning a
  // failed save can put the board back. Null when there is no row to restore.
  readonly restore: DraftPatch | null;
}

interface OverviewEditDialogState extends OverviewComposerState {
  readonly mode: "edit";
  readonly target: StatusOverviewEditTarget;
  readonly item: KanbanItem;
  readonly promotion?:
    | {
        readonly target: "current" | "next";
        readonly commandId: string;
        readonly sourceItem: KanbanItem;
        readonly pending: boolean;
      }
    | undefined;
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
    stableId: item?.stableId ?? null,
    week: target.source,
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

function OverviewItemDialog({
  editor,
  dialog,
  onSave,
  onCancel,
  onWeekChange,
  saveDisabled = false,
}: {
  readonly editor: ReadyEditor;
  readonly dialog: OverviewItemDialogState;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onWeekChange?: ((week: "current" | "next") => void) | undefined;
  readonly saveDisabled?: boolean | undefined;
}) {
  const viewModel = editor.view.viewModel;
  const createTarget = dialog.mode === "create" ? dialog.target : null;
  return (
    <ItemInlineEditor
      key={
        dialog.mode === "edit"
          ? `edit:${dialog.week}:${dialog.target.recordId}`
          : `create:${dialog.week}:${dialog.target.unitKind}:${dialog.target.unitId}`
      }
      item={dialog.mode === "edit" ? dialog.item : null}
      draftStore={dialog.draftStore}
      saveDisabled={saveDisabled}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      week={dialog.week}
      onWeekChange={onWeekChange}
      showNextStep={false}
      showPriority={false}
      confirmationOnly={dialog.mode === "edit" && dialog.promotion != null}
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

export function OverviewEditorDialog({
  editor,
  dialog,
  isReadOnly,
  saveDisabled,
  onSave,
  onCancel,
  onWeekChange,
}: {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly saveDisabled: boolean;
  readonly onSave: (item: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onWeekChange: (week: "current" | "next") => void;
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
        onWeekChange={onWeekChange}
      />
    </fieldset>
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
