import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SetDialog = (
  action: (
    current: OverviewItemDialogState | null,
  ) => OverviewItemDialogState | null,
) => void;

type Discard = NonNullable<
  NonNullable<OverviewItemDialogState["submission"]>["discard"]
>;

function markDiscard(setDialog: SetDialog, discard: Discard, next: Discard) {
  setDialog((current) =>
    current?.submission?.discard?.token === discard.token
      ? { ...current, submission: { ...current.submission, discard: next } }
      : current,
  );
}

export function settleOriginalBeforeDiscard(
  editor: ReadyEditor,
  recovery: NonNullable<ReadyEditor["draft"]["saveRecovery"]>,
  discard: Discard,
  setDialog: SetDialog,
): void {
  if (recovery.phase === "reconciliation") {
    markDiscard(setDialog, discard, { ...discard, armed: true, failed: true });
    return;
  }
  if (recovery.phase !== "ambiguous" || recovery.pendingTransports > 0) return;
  if (discard.retried) {
    markDiscard(setDialog, discard, { ...discard, armed: true, failed: true });
    return;
  }
  markDiscard(setDialog, discard, { ...discard, retried: true });
  editor.draft.retrySameAttempt?.(recovery.token);
}
