import type { DraftPatch } from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import {
  findOverviewDraftItem,
  overviewSubmittedItemIsCurrent,
} from "./overview-editor-recovery";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

// Snapshot of the row a first Save is about to overwrite. Later attempts keep
// the first snapshot: the draft already holds the failed attempt by then.
export function restorePatchFor(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): DraftPatch | null {
  if (dialog.submission) return dialog.submission.restore;
  const row = findOverviewDraftItem(editor, dialog);
  return row?.id ? { kind: "item-patch", itemId: row.id, patch: row } : null;
}

// Patch that undoes a Save the lead abandons after it failed. Only the failed
// state qualifies: a save in flight may still land, and a draft edited since
// the submission is no longer this update's to revert.
export function abandonedSaveRestorePatch(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): DraftPatch | null {
  const submission = dialog.submission;
  if (
    !submission ||
    editor.draft.autosave.state !== "error" ||
    dialog.generation !== editor.generation ||
    !overviewSubmittedItemIsCurrent(editor, dialog)
  )
    return null;
  if (dialog.mode === "edit") return submission.restore;
  const week = dialog.week;
  const rows =
    week === "current"
      ? editor.view.viewModel.ownCurrentWeekItems
      : editor.view.viewModel.ownNextWeekItems;
  return {
    kind: "week-items",
    week,
    items: rows.filter((row) => row.id !== submission.item.id),
  };
}
