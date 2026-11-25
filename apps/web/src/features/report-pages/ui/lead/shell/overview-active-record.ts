import type {
  ActiveRecordEditor,
  KanbanItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { itemChange } from "./overview-reversible-changes";
import type { ReadyEditor } from "./use-overview-controller";
import type { OverviewUndoWrite } from "./use-overview-undo";
interface PanelActions {
  dialog: OverviewItemDialogState | null;
  recoveryReason: string | null;
  error: string | null;
  close: () => void;
  leave:()=>void;
  showDetails: () => void;
  save: (value: KanbanItem) => void;
}
export function recordPanel(
  editor: ReadyEditor | null,
  actions: PanelActions,
  model: StatusOverviewModel,
  undo: { write: (change: OverviewUndoWrite) => Promise<boolean> },
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
  const occurrence = model.units
    .flatMap(
      (unit) =>
        unit.columns[source === "next" ? "nextWeek" : "currentWeek"].items,
    )
    .find((item) => item.recordId === dialog.target.recordId);
  if (!occurrence?.editTarget || !occurrence.recordId) return null;
  const store = dialog.draftStore;
  return {
    id: occurrence.recordId,
    stableId: dialog.stableId,
    source,
    store,
    pending: dialog.submission !== null && !actions.error,
    error: actions.error,
    close: actions.close,leave:actions.leave,
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
      const unit = model.units.find(
        (candidate) =>
          candidate.columns.currentWeek.items.some(
            (row) => row === occurrence,
          ) ||
          candidate.columns.nextWeek.items.some((row) => row === occurrence),
      );
      if (
        !unit ||
        (!onlyStep &&
          [
            ...unit.columns.lastWeek.items,
            ...unit.columns.priorCommitments.items,
          ].some((row) => row.stableId && row.stableId === occurrence.stableId))
      )
        return;
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
