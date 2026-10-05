import type { SetStateAction } from "react";

import { type OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { overviewSubmissionIsAcknowledged } from "./overview-editor-recovery";
import { abandonedSaveRestorePatch } from "./overview-save-restore";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SetDialog = (
  action: SetStateAction<OverviewItemDialogState | null>,
) => void;

interface SubmissionContext {
  readonly editor: ReadyEditor | null;
  readonly dialog: OverviewItemDialogState | null;
  readonly recoveryReason: string | null;
  readonly setDialog: SetDialog;
}

// Plain function so the mutable attempt ref can be written outside a hook body.
export function driveOverviewSubmission({
  editor,
  dialog,
  recoveryReason,
  setDialog,
  startedAttempt,
}: SubmissionContext & {
  readonly startedAttempt: { current: number | null };
}): void {
  const submission = dialog?.submission;
  if (!editor || !dialog || !submission) return;
  if (!submission.saveArmed) {
    setDialog((current) =>
      current?.submission?.attempt === submission.attempt
        ? {
            ...current,
            submission: { ...current.submission, saveArmed: true },
          }
        : current,
    );
    return;
  }
  const autosave = editor.draft.autosave;
  const active =
    autosave.dirty ||
    autosave.isInFlight ||
    autosave.state === "pending" ||
    autosave.state === "saving" ||
    autosave.state === "error";
  if (active && !submission.activityObserved) {
    setDialog((current) =>
      current?.submission?.attempt === submission.attempt
        ? {
            ...current,
            submission: { ...current.submission, activityObserved: true },
          }
        : current,
    );
  }
  if (!recoveryReason && startedAttempt.current !== submission.attempt) {
    startedAttempt.current = submission.attempt;
    const attempt = submission.attempt;
    queueMicrotask(() => {
      if (startedAttempt.current === attempt) void editor.draft.save();
    });
  }
  const acknowledged =
    startedAttempt.current === submission.attempt &&
    autosave.state !== "error" &&
    !recoveryReason &&
    overviewSubmissionIsAcknowledged(editor, dialog);
  if (acknowledged) {
    startedAttempt.current = null;
    setDialog((current) =>
      current?.submission?.attempt === submission.attempt ? null : current,
    );
  }
}

export function overviewSaveFailure(
  editor: ReadyEditor | null,
  dialog: OverviewItemDialogState | null,
): string | null {
  return dialog?.submission && editor?.draft.autosave.state === "error"
    ? "Save failed. Your update is still here; try saving again."
    : null;
}

// Closing an abandoned save restores the pre-edit draft; recovery dialogs
// never wrote anything, so they restore nothing.
export function closeOverviewDialog({
  editor,
  dialog,
  recoveryReason,
  setDialog,
}: SubmissionContext): void {
  const restore =
    editor && dialog && !recoveryReason
      ? abandonedSaveRestorePatch(editor, dialog)
      : null;
  if (editor && restore) editor.draft.apply(restore);
  setDialog(null);
}
