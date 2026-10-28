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
  // Advances when Save and add another resets the composer. The editor keys on
  // it so it remounts with the fresh draft store instead of keeping the saved
  // row's text and losing the focus-on-mount behaviour.
  readonly seq: number;
}

interface OverviewItemSubmission {
  readonly attempt: number;
  readonly token: string;
  readonly receiptScope: string;
  readonly discard?:
    | {
        readonly token: string;
        readonly armed: boolean;
        readonly failed: boolean;
      }
    | undefined;
  readonly item: KanbanItem;
  readonly inputSnapshot: ReturnType<ItemEditDraftStore["getSnapshot"]>;
  readonly lastSavedAtBefore: Date | null;
  readonly draftVersionBefore: number;
  readonly saveReceiptSequenceBefore: number;
  readonly saveArmed: boolean;
  readonly activityObserved: boolean;
  readonly addAnother?: boolean | undefined;
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
        readonly target: "current";
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
    seq: 0,
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
      stageMemory: editor.draft.stageMemory,
      stagesForProduct: (productId) =>
        ownedStagesForProject(editor.draft.section, productId),
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
  onSaveAndAddAnother,
  onCancel,
  onWeekChange,
  saveDisabled = false,
}: {
  readonly editor: ReadyEditor;
  readonly dialog: OverviewItemDialogState;
  readonly onSave: (item: KanbanItem) => void;
  readonly onSaveAndAddAnother?: ((item: KanbanItem) => void) | undefined;
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
          : `create:${dialog.week}:${dialog.target.unitKind}:${dialog.target.unitId}:${dialog.seq}`
      }
      item={dialog.mode === "edit" ? dialog.item : null}
      draftStore={dialog.draftStore}
      saveDisabled={saveDisabled}
      products={viewModel.products}
      activities={viewModel.activityOptions}
      week={dialog.week}
      onWeekChange={onWeekChange}
      // C4929: while a submission exists the host drops every week change, so
      // the radios stay visible but honestly disabled instead of silently inert.
      weekChangeDisabled={dialog.submission !== null}
      showNextStep={false}
      showPriority={false}
      confirmationOnly={
        (dialog.mode === "edit" && dialog.promotion != null) || saveDisabled
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
      onSaveAndAddAnother={onSaveAndAddAnother}
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
  onSaveAndAddAnother,
  onCancel,
  onWeekChange,
}: {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly isReadOnly: boolean;
  readonly saveDisabled: boolean;
  readonly onSave: (item: KanbanItem) => void;
  readonly onSaveAndAddAnother?: ((item: KanbanItem) => void) | undefined;
  readonly onCancel: () => void;
  readonly onWeekChange: (week: "current" | "next") => void;
}) {
  if (!editor || !dialog || isReadOnly) return null;
  if (dialog.generation !== editor.generation) return null;
  // saveDisabled locks only the editable fields (via confirmationOnly inside
  // the editor); Cancel stays reachable so a hung save never traps the lead.
  // Abandoning mid-flight restores nothing — a save in flight may still land.
  return (
    <OverviewItemDialog
      editor={editor}
      dialog={dialog}
      saveDisabled={saveDisabled}
      onSave={onSave}
      onSaveAndAddAnother={onSaveAndAddAnother}
      onCancel={onCancel}
      onWeekChange={onWeekChange}
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
