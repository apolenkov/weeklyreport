import type {
  ActiveRecordEditor,
  KanbanItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { itemChange } from "./overview-reversible-changes";
import { workSignature } from "./overview-undo";
import type { ReadyEditor } from "./use-overview-controller";
import type { OverviewUndoWrite, UndoOffer } from "./use-overview-undo";
interface PanelActions {
  dialog: OverviewItemDialogState | null;
  recoveryReason: string | null;
  error: string | null;
  close: () => void;
  leave: () => void;
  restoreDialog: (saved: OverviewItemDialogState) => void;
  showDetails: (origin: HTMLElement) => void;
  save: (value: KanbanItem) => void;
}
export function recordPanel(
  editor: ReadyEditor | null,
  actions: PanelActions,
  model: StatusOverviewModel,
  undo: {
    write: (change: OverviewUndoWrite) => Promise<boolean>;
    announce: (offer: UndoOffer) => void;
  },
): ActiveRecordEditor | null {
  const dialog = actions.dialog;
  if (
    !editor ||
    dialog?.mode !== "edit" ||
    dialog.surface !== "record" ||
    actions.recoveryReason
  )
    return null;
  const step = dialog.target.focusNextStep === true;
  const source = step ? "next" : dialog.week;
  const occurrence = findOccurrence(model, source, dialog.target.recordId);
  if (!occurrence?.editTarget || !occurrence.recordId) return null;
  const store = dialog.draftStore;
  const failed = !!dialog.submission && editor.draft.autosave.state === "error";
  const published =
    editor.view.viewModel.publishedLockedItemIds.has(occurrence.recordId) ||
    isPublished(model, occurrence);
  return {
    id: occurrence.recordId,
    failed,
    stableId: dialog.stableId,
    source,
    store,
    published,
    detailsOpen: dialog.detailsOpen === true,
    pending: dialog.submission !== null && !actions.error,
    error: failed
      ? "Not saved. The connection dropped. Your text is kept here."
      : actions.error,
    close: actions.close,
    discard: () => discardRecordDraft(editor, actions, dialog, undo.announce),
    leave: actions.leave,
    details: actions.showDetails,
    save: () => {
      const fields = store.getSnapshot();
      actions.save({
        ...dialog.item,
        text: fields.text.trim(),
        stageNames: fields.stageNames,
        nextStepText: fields.nextStepText.trim() || null,
      });
    },
    remove: (onlyStep) => {
      if (dialog.submission) return;
      if (!onlyStep && published) return;
      const change = itemChange(
        editor,
        occurrence,
        onlyStep ? "step" : "delete",
      );
      if (change) {
        actions.close();
        void undo.write(change);
      }
    },
    move: () => {
      if (store.isDirty() || dialog.submission) return;
      const change = itemChange(editor, occurrence, "move");
      if (change) {
        actions.close();
        void undo.write(change);
      }
    },
  };
}

function findOccurrence(
  model: StatusOverviewModel,
  source: "current" | "next",
  id: string,
) {
  return model.units
    .flatMap(
      (unit) =>
        unit.columns[source === "next" ? "nextWeek" : "currentWeek"].items,
    )
    .find((item) => item.recordId === id);
}

function discardRecordDraft(
  editor: ReadyEditor,
  actions: PanelActions,
  dialog: OverviewItemDialogState,
  announce: (offer: UndoOffer) => void,
) {
  actions.close();
  if (dialog.submission || !dialog.stableId || !dialog.draftStore.isDirty())
    return;
  const target = { kind: "item" as const, stableId: dialog.stableId };
  announce({
    target,
    scope: editor.draft.receiptScope,
    signature: workSignature(editor.draft.section, target),
    input: true,
    message: "Draft discarded.",
    reverse: () => ({
      kind: "restore-input",
      restore: () => actions.restoreDialog(dialog),
    }),
  });
}

function isPublished(
  model: StatusOverviewModel,
  occurrence: NonNullable<ReturnType<typeof findOccurrence>>,
) {
  return model.units.some((unit) =>
    [
      ...unit.columns.lastWeek.items,
      ...unit.columns.priorCommitments.items,
    ].some((row) => row.stableId && row.stableId === occurrence.stableId),
  );
}
