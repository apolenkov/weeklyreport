import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { matchesCreatedRecord } from "../../../../report-sections";
import { recordAcknowledged } from "./overview-record-confirmation";
import { overviewRecordScopeReason } from "./overview-record-context";
import { driveRecordDiscard } from "./overview-record-discard";
import {
  type OverviewRecordState,
  type SetOverviewRecord,
  updateRecordAttempt,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";

interface Ticket {
  readonly token: string;
}

function patchPreparedRecord(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
): void {
  const submission = state.submission;
  if (!submission) return;
  editor.draft.apply(
    submission.before
      ? {
          kind: "replace-created-record",
          reportSectionId: state.reportSectionId,
          record: submission.record,
          previous: submission.before,
        }
      : {
          kind: "create-record",
          reportSectionId: state.reportSectionId,
          record: submission.record,
        },
  );
  updateRecordAttempt(setState, submission.token, (current, active) => ({
    ...current,
    submission: { ...active, phase: "patched" },
  }));
}

function armRecordSave(
  editor: ReadyEditor,
  state: OverviewRecordState,
  setState: SetOverviewRecord,
  started: { current: Ticket | null },
): void {
  const submission = state.submission;
  if (!submission || started.current?.token === submission.token) return;
  if (!matchesCreatedRecord(editor.draft.section, submission.record)) {
    const message =
      "This record changed before saving. Your input is retained.";
    updateRecordAttempt(setState, submission.token, (current) =>
      current.message === message ? current : { ...current, message },
    );
    return;
  }
  const ticket = { token: submission.token };
  started.current = ticket;
  updateRecordAttempt(setState, submission.token, (current, active) => ({
    ...current,
    submission: { ...active, phase: "saving" },
  }));
  // Wait for the patched section to reach the existing autosave engine.
  queueMicrotask(() => {
    if (started.current === ticket)
      void editor.draft.savePersisted(submission.token);
  });
}

function finishRecordSave(
  state: OverviewRecordState,
  setState: SetOverviewRecord,
): void {
  const submission = state.submission;
  if (!submission) return;
  updateRecordAttempt(setState, submission.token, (current, active) => {
    if (active.cancelRequested) return current;
    if (JSON.stringify(current.value) === JSON.stringify(submission.input))
      return null;
    return {
      ...current,
      baseline: submission.record,
      initial: submission.input,
      submission: null,
      message:
        "The submitted draft was saved. Your later changes are still here; save them separately.",
    };
  });
}

export function useOverviewRecordSubmission(
  editor: ReadyEditor | null,
  state: OverviewRecordState | null,
  setState: SetOverviewRecord,
): void {
  const started = useRef<Ticket | null>(null);
  useEffect(
    () => () => {
      started.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!state || !editor || overviewRecordScopeReason(editor, state)) {
      started.current = null;
      return;
    }
    const submission = state.submission;
    if (!submission) return;
    if (submission.phase === "prepared") {
      patchPreparedRecord(editor, state, setState);
      return;
    }
    if (submission.phase === "patched") {
      armRecordSave(editor, state, setState, started);
      return;
    }
    if (submission.cancelRequested) {
      driveRecordDiscard(editor, state, setState, started);
      return;
    }
    if (
      started.current?.token === submission.token &&
      recordAcknowledged(editor, state, submission.record, submission.token)
    ) {
      started.current = null;
      const entry = submission.record.entry;
      const needsDetails =
        !entry.impact ||
        (submission.record.kind === "risk" &&
          !submission.record.entry.mitigation);
      toast.success(
        needsDetails ? "Saved draft — needs details" : "Draft saved",
      );
      finishRecordSave(state, setState);
    }
  }, [editor, state, setState]);
}
