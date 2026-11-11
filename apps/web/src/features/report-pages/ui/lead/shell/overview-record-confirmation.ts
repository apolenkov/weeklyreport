import {
  confirmSavedRecord,
  confirmSavedRecordRemoval,
  matchesCreatedRecord,
} from "../../../../report-sections";
import type {
  OverviewRecordState,
  OverviewRecordSubmission,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";

type CreatedRecord = OverviewRecordSubmission["record"];

export function recordAcknowledged(
  editor: ReadyEditor,
  state: OverviewRecordState,
  record: CreatedRecord,
  token: string,
): boolean {
  const receipt = editor.draft.lastSaveReceipt;
  const stableId = record.entry.stableId;
  if (
    !receipt ||
    !stableId ||
    editor.draft.saveRecovery ||
    editor.draft.autosave.state === "error"
  )
    return false;
  return (
    confirmSavedRecord(receipt, {
      kind: record.kind,
      stableId,
      scope: state.receiptScope,
      generation: state.generation,
      reportSectionId: state.reportSectionId,
      attemptToken: token,
    }) &&
    matchesCreatedRecord(
      {
        ...editor.draft.section,
        risks: receipt.persistedRisks ?? [],
        decisions: receipt.persistedDecisions ?? [],
      },
      record,
    ) &&
    matchesCreatedRecord(editor.draft.section, record)
  );
}

export function recordIsAbsent(
  editor: ReadyEditor,
  record: CreatedRecord,
): boolean {
  const rows =
    record.kind === "risk"
      ? editor.draft.section.risks
      : editor.draft.section.decisions;
  return !rows.some((row) => row.stableId === record.entry.stableId);
}

export function removalAcknowledged(
  editor: ReadyEditor,
  state: OverviewRecordState,
  record: CreatedRecord,
  token: string,
): boolean {
  const receipt = editor.draft.lastSaveReceipt;
  const stableId = record.entry.stableId;
  if (
    !receipt ||
    !stableId ||
    editor.draft.saveRecovery ||
    editor.draft.autosave.state === "error"
  )
    return false;
  return (
    confirmSavedRecordRemoval(receipt, {
      kind: record.kind,
      stableId,
      scope: state.receiptScope,
      generation: state.generation,
      reportSectionId: state.reportSectionId,
      attemptToken: token,
    }) && recordIsAbsent(editor, record)
  );
}
