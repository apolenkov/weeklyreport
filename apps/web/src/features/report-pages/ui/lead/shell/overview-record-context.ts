import { ownedStagesForProject } from "../../../../report-sections";
import {
  prepareContextualDecision,
  prepareContextualRisk,
} from "./overview-contextual-records";
import type {
  OverviewRecordState,
  OverviewRecordSubmission,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";

export function isRecordScopeDetached(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
): boolean {
  return (
    !!editor &&
    (editor.generation !== state.generation ||
      editor.draft.receiptScope !== state.receiptScope ||
      editor.draft.section.reportSectionId !== state.reportSectionId)
  );
}

export function overviewRecordScopeReason(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
): string | null {
  if (!editor || editor.view.viewModel.isReadOnly)
    return "This report is not editable. Your input is still here.";
  if (isRecordScopeDetached(editor, state))
    return "The report draft changed. Your input is retained and has not overwritten the new draft.";
  return null;
}

// The engine keeps a save barrier until an attempt's exact receipt or an explicit
// abandon, and only an editable composer can drive that release. A read-only
// composer therefore stays open while one of its attempts is unresolved.
export function holdsUnresolvedAttempt(
  editor: ReadyEditor | null,
  submission: OverviewRecordSubmission,
): boolean {
  if (
    submission.phase === "not-sent" ||
    submission.phase === "restoring" ||
    submission.discard?.notSent === true
  )
    return true;
  const recovery = editor?.draft.saveRecovery;
  return (
    !!recovery &&
    (recovery.token === submission.token ||
      recovery.token === submission.discard?.token)
  );
}

export function canCloseSubmittedRecord(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
): boolean {
  const submission = state.submission;
  if (!submission) return false;
  if (isRecordScopeDetached(editor, state) || submission.phase === "unresolved")
    return true;
  return (
    !!editor &&
    editor.view.viewModel.isReadOnly &&
    !editor.draft.autosave.isInFlight &&
    (editor.draft.saveRecovery?.pendingTransports ?? 0) === 0 &&
    editor.draft.saveRecovery?.phase !== "pending" &&
    !holdsUnresolvedAttempt(editor, submission)
  );
}

export function overviewRecordEligibleStages(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
): readonly string[] {
  return editor && state.parent.kind === "product"
    ? ownedStagesForProject(editor.draft.section, state.parent.id)
    : [];
}

export function prepareOverviewRecord(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
):
  | { readonly ok: true; readonly record: OverviewRecordSubmission["record"] }
  | { readonly ok: false; readonly errors: Readonly<Record<string, string>> } {
  const reason = overviewRecordScopeReason(editor, state);
  if (reason || !editor)
    return {
      ok: false,
      errors: { context: reason ?? "The editor is unavailable." },
    };
  const section = editor.draft.section;
  const products = editor.view.viewModel.products.filter((product) =>
    section.projects.some((assigned) => assigned.projectId === product.id),
  );
  const context = {
    parent: state.parent,
    identity: state.identity,
    eligibleStages: overviewRecordEligibleStages(editor, state),
    eligibleParents: [
      ...products.map((product) => ({
        kind: "product" as const,
        id: product.id,
        name: product.name,
        product,
      })),
      ...section.activities.map((activity) => ({
        kind: "activity" as const,
        id: activity.activityId,
        name: activity.activityName,
      })),
    ],
  };
  if (state.kind === "risk") {
    const result = prepareContextualRisk({ ...context, input: state.value });
    return result.ok
      ? { ok: true, record: { kind: "risk", entry: result.record } }
      : result;
  }
  const result = prepareContextualDecision({
    ...context,
    input: state.value,
    authorName: section.authorName,
  });
  return result.ok
    ? { ok: true, record: { kind: "decision", entry: result.record } }
    : result;
}
