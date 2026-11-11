import { matchesCreatedRecord } from "../../../../report-sections";
import {
  recordAcknowledged,
  recordIsAbsent,
  removalAcknowledged,
} from "./overview-record-confirmation";
import {
  type OverviewRecordState,
  type SetOverviewRecord,
  updateRecordAttempt,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";

function retainDiscardError(
  state: OverviewRecordState,
  setState: SetOverviewRecord,
  message: string,
): void {
  if (state.submission)
    updateRecordAttempt(setState, state.submission.token, (current) =>
      current.message === message ? current : { ...current, message },
    );
}

function settleRecordOriginal(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
): boolean {
  const submission = state.submission;
  const recovery = editor.draft.saveRecovery;
  if (!submission || !recovery) return false;
  if (recovery.token !== submission.token) return true;
  if (recovery.phase === "pending" || recovery.pendingTransports > 0)
    return true;
  if (recovery.phase === "ambiguous" && !submission.cancelRetried) {
    updateRecordAttempt(setState, submission.token, (current, active) => ({
      ...current,
      submission: { ...active, cancelRetried: true },
    }));
    editor.draft.retrySameAttempt?.(submission.token);
    return true;
  }
  retainDiscardError(
    state,
    setState,
    recovery.phase === "ambiguous"
      ? "Cancellation is not confirmed. Your input is retained; Save retries the original request."
      : "The original save needs reconciliation. Keep a copy of your input and reload the report before discarding it.",
  );
  return true;
}

function applyRecordCompensation(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
): void {
  const submission = state.submission;
  if (!submission) return;
  if (!recordAcknowledged(editor, state, submission.record, submission.token)) {
    if (editor.draft.lastSaveReceipt?.attemptToken === submission.token)
      retainDiscardError(
        state,
        setState,
        "This record changed after saving. Cancellation has not removed those changes; your input is retained.",
      );
    return;
  }
  editor.draft.apply(
    submission.before
      ? {
          kind: "replace-created-record",
          reportSectionId: state.reportSectionId,
          previous: submission.record,
          record: submission.before,
        }
      : {
          kind: "discard-created-record",
          reportSectionId: state.reportSectionId,
          record: submission.record,
        },
  );
  const token = crypto.randomUUID();
  updateRecordAttempt(setState, submission.token, (current, active) => ({
    ...current,
    message: null,
    submission: { ...active, discard: { token, armed: false } },
  }));
}

function armCompensation(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
  started: { current: { readonly token: string } | null },
): void {
  const submission = state.submission;
  const discard = submission?.discard;
  if (!submission || !discard) return;
  const matches = submission.before
    ? matchesCreatedRecord(editor.draft.section, submission.before)
    : recordIsAbsent(editor, submission.record);
  if (!matches) {
    retainDiscardError(
      state,
      setState,
      "This record changed before cancellation could be saved. Your input is retained.",
    );
    return;
  }
  const ticket = { token: discard.token };
  if (started.current?.token === ticket.token) return;
  started.current = ticket;
  updateRecordAttempt(setState, submission.token, (current, active) => ({
    ...current,
    submission: { ...active, discard: { ...discard, armed: true } },
  }));
  queueMicrotask(() => {
    if (started.current === ticket)
      void editor.draft.savePersisted(ticket.token);
  });
}

function driveCompensation(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
  started: { current: { readonly token: string } | null },
): void {
  const submission = state.submission;
  const discard = submission?.discard;
  if (!submission || !discard) return;
  if (!discard.armed) {
    armCompensation(editor, state, setState, started);
    return;
  }
  const recovery = editor.draft.saveRecovery;
  if (recovery?.token === discard.token && recovery.phase !== "pending") {
    retainDiscardError(
      state,
      setState,
      recovery.phase === "ambiguous"
        ? "Cancellation is not confirmed. Save retries only the cancellation request."
        : "Cancellation needs reconciliation. Keep a copy of your input and reload the report.",
    );
    return;
  }
  const confirmed = submission.before
    ? recordAcknowledged(editor, state, submission.before, discard.token)
    : removalAcknowledged(editor, state, submission.record, discard.token);
  if (confirmed) {
    started.current = null;
    updateRecordAttempt(setState, submission.token, () => null);
  }
}

export function driveRecordDiscard(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
  started: { current: { readonly token: string } | null },
): void {
  if (state.submission?.discard) {
    driveCompensation(editor, state, setState, started);
    return;
  }
  if (!settleRecordOriginal(editor, state, setState))
    applyRecordCompensation(editor, state, setState);
}
