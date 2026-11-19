import { matchesCreatedRecord } from "../../../../report-sections";
import {
  type OverviewRecordState,
  type SetOverviewRecord,
  updateRecordAttempt,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";

type SaveResult = Awaited<ReturnType<ReadyEditor["draft"]["savePersisted"]>>;

export function retainUnsentRecord(
  setState: SetOverviewRecord,
  originalToken: string,
  result: SaveResult,
): void {
  if (result.status === "accepted") return;
  if (result.status === "obsolete") {
    updateRecordAttempt(setState, originalToken, (current, submission) => ({
      ...current,
      submission: { ...submission, phase: "unresolved" },
    }));
    return;
  }
  updateRecordAttempt(setState, originalToken, (current, submission) => ({
    ...current,
    message:
      submission.discard?.token === result.token
        ? "Cancellation did not start. Save retries the cancellation; your input is retained."
        : "The save did not start. Your input is retained; try Save again or cancel.",
    submission:
      submission.discard?.token === result.token
        ? {
            ...submission,
            discard: { ...submission.discard, armed: false, notSent: true },
          }
        : { ...submission, phase: "not-sent" },
  }));
}

// An engine-owned dispatched attempt always retains recovery until its exact
// receipt. A dropped queue entry has neither: restore only its unchanged local
// lineage, then release the barrier after the restored draft is observed.
export function discardUnsentRecord(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
): void {
  const submission = state.submission;
  if (!submission || editor.draft.saveRecovery?.token === submission.token)
    return;
  if (
    (submission.before &&
      matchesCreatedRecord(editor.draft.section, submission.before)) ||
    !matchesCreatedRecord(editor.draft.section, submission.record)
  ) {
    editor.draft.abandonPersisted(submission.token);
    updateRecordAttempt(setState, submission.token, (current, active) =>
      active.cancelRequested ? null : { ...current, submission: null },
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
  if (submission.phase !== "restoring")
    updateRecordAttempt(setState, submission.token, (current, active) => ({
      ...current,
      submission: { ...active, phase: "restoring" },
    }));
}
