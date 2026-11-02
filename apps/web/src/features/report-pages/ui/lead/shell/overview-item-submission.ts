import { type SetStateAction, useEffect } from "react";

import {
  createOverviewComposerState,
  type OverviewItemDialogState,
} from "./lead-status-overview-item-editor";
import {
  type AcknowledgedOverviewItem,
  overviewAcknowledgedItem,
} from "./overview-editor-recovery";
import { abandonedSaveRestorePatch } from "./overview-save-restore";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";
import type { OverviewCreatedFocus } from "./use-overview-focus-return";

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

function driveDiscard(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  setDialog: SetDialog,
): void {
  const discard = dialog.submission?.discard;
  if (!discard || discard.armed || discard.failed) return;
  setDialog((current) =>
    current?.submission?.discard?.token === discard.token
      ? {
          ...current,
          submission: {
            ...current.submission,
            discard: { ...discard, armed: true },
          },
        }
      : current,
  );
  // This effect runs before the autosave hook re-stamps the restored payload,
  // so the save is deferred until the restore patch has reached the engine.
  queueMicrotask(() => {
    void editor.draft.savePersisted(discard.token).then((result) => {
      setDialog((current) => {
        if (
          current?.submission?.discard?.token !== discard.token ||
          current.generation !== dialog.generation
        )
          return current;
        return result.status === "accepted"
          ? null
          : {
              ...current,
              submission: {
                ...current.submission,
                discard: { ...discard, armed: true, failed: true },
              },
            };
      });
    });
  });
}

function submittedScopeMatches(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
): boolean {
  return (
    dialog.generation === editor.generation &&
    dialog.submission?.receiptScope === editor.draft.receiptScope
  );
}

interface DriveRefs {
  readonly startedAttempt: { current: number | null };
  readonly createdFocus: { current: OverviewCreatedFocus | null };
}

// The save this effect started must still be the open attempt, with no failed
// write and no recovery in force, before its confirmed receipt may close.
function acknowledgedAttempt(
  editor: ReadyEditor,
  dialog: OverviewItemDialogState,
  startedAttempt: { current: number | null },
  recoveryReason: string | null,
): AcknowledgedOverviewItem | undefined {
  const attempt = dialog.submission?.attempt;
  if (
    attempt === undefined ||
    startedAttempt.current !== attempt ||
    editor.draft.autosave.state === "error" ||
    recoveryReason
  )
    return undefined;
  return overviewAcknowledgedItem(editor, dialog);
}

// Only a plain create closes onto its new item. Add-another keeps the composer
// open, and cancel or edit exits never reach this function with a target.
function rememberCreatedFocus(
  createdFocus: { current: OverviewCreatedFocus | null },
  dialog: OverviewItemDialogState,
  acknowledged: AcknowledgedOverviewItem,
): void {
  if (dialog.mode !== "create" || dialog.submission?.addAnother) return;
  createdFocus.current = {
    identity: acknowledged.stableId,
    week: acknowledged.week,
  };
}

// Plain function so the mutable attempt ref can be written outside a hook body.
function driveOverviewSubmission({
  editor,
  dialog,
  recoveryReason,
  setDialog,
  startedAttempt,
  createdFocus,
}: SubmissionContext & DriveRefs): void {
  const submission = dialog?.submission;
  if (!editor || !dialog || !submission) return;
  if (!submittedScopeMatches(editor, dialog)) return;
  if (submission.discard) {
    driveDiscard(editor, dialog, setDialog);
    return;
  }
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
      if (startedAttempt.current === attempt)
        void editor.draft.savePersisted(submission.token);
    });
  }
  const acknowledged = acknowledgedAttempt(
    editor,
    dialog,
    startedAttempt,
    recoveryReason,
  );
  if (acknowledged) {
    startedAttempt.current = null;
    rememberCreatedFocus(createdFocus, dialog, acknowledged);
    setDialog((current) => {
      if (current?.submission?.attempt !== submission.attempt) return current;
      if (submission.addAnother && current.mode === "create") {
        // Keep creating in the week the lead actually saved to, not the week
        // the dialog opened with.
        const target = { ...current.target, source: current.week };
        return {
          ...createOverviewComposerState(editor, target, null),
          mode: "create",
          target,
          seq: current.seq + 1,
        };
      }
      return null;
    });
  }
}

export function useOverviewSubmissionDriver({
  editor,
  dialog,
  recoveryReason,
  setDialog,
  startedAttempt,
  createdFocus,
}: SubmissionContext & DriveRefs): void {
  useEffect(() => {
    driveOverviewSubmission({
      editor,
      dialog,
      recoveryReason,
      setDialog,
      startedAttempt,
      createdFocus,
    });
  }, [dialog, editor, recoveryReason, setDialog, startedAttempt, createdFocus]);
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
  if (dialog?.submission?.discard) {
    if (dialog.submission.discard.failed) {
      editor?.draft.abandonPersisted(dialog.submission.discard.token);
      setDialog(null);
    }
    return;
  }
  if (editor && dialog?.submission && restore) {
    editor.draft.apply(restore);
    setDialog({
      ...dialog,
      submission: {
        ...dialog.submission,
        discard: { token: crypto.randomUUID(), armed: false, failed: false },
      },
    });
    return;
  }
  setDialog(null);
}
