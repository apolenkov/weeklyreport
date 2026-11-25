import type {
  DecisionInput,
  RiskComposerProps,
  RiskInput,
  StatusOverviewModel,
  StatusOverviewRecordSlot,
} from "../../../../report-sections";
import {
  StatusOverviewInlineDecisionForm,
  StatusOverviewInlineRiskForm,
  useInlineEditUnloadGuard,
} from "../../../../report-sections/client";
import {
  canCloseSubmittedRecord,
  holdsUnresolvedAttempt,
  overviewRecordEligibleStages,
  overviewRecordScopeReason,
} from "./overview-record-context";
import {
  isRecordInputEdited,
  type OverviewRecordState,
} from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";
interface RecordActions {
  readonly state: OverviewRecordState | null;
  readonly submit: () => void;
  readonly close: () => void;
  readonly switchKind?: () => void;
  readonly changeRisk: (value: RiskInput) => void;
  readonly changeDecision: (value: DecisionInput) => void;
}

function recordPending(
  editor: ReadyEditor | null,
  submission: OverviewRecordState["submission"],
  recovery: ReadyEditor["draft"]["saveRecovery"] | undefined,
) {
  if (!submission || submission.discard?.notSent) return false;
  return (
    submission.phase !== "saving" ||
    (recovery?.pendingTransports ?? 0) > 0 ||
    recovery?.phase === "pending" ||
    editor?.draft.autosave.isInFlight === true
  );
}

function recordSaveProgress(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
) {
  const submission = state.submission;
  const token = submission?.discard?.token ?? submission?.token;
  const recovery = editor?.draft.saveRecovery;
  const matchingRecovery = recovery?.token === token ? recovery : null;
  const notSent = submission?.discard?.notSent === true;
  const pending = recordPending(editor, submission, matchingRecovery);
  const retry = notSent || matchingRecovery?.phase === "ambiguous";
  const recoveryMessage =
    matchingRecovery?.phase === "reconciliation"
      ? "This save needs reconciliation. Keep a copy of your input and reload the report before saving again."
      : retry
        ? "The save is not confirmed. Save retries the original request; your later changes stay here."
        : null;
  return { pending, retry, recoveryMessage };
}

function recordView(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
  blocked: string | null,
): RiskComposerProps["view"] {
  const { pending, retry, recoveryMessage } = recordSaveProgress(editor, state);
  const detached = canCloseSubmittedRecord(editor, state);
  const unresolved =
    (!editor || editor.view.viewModel.isReadOnly) &&
    state.submission !== null &&
    holdsUnresolvedAttempt(editor, state.submission);
  return {
    eligibleStages: overviewRecordEligibleStages(editor, state),
    authorName: editor?.draft.section.authorName ?? "Unavailable",
    errors: state.errors,
    message: detached
      ? "This input cannot be saved from this editor. Closing it does not undo an earlier save, which may still finish. Check the report before creating another record."
      : unresolved
        ? "The save is not resolved and the report is not editable. Your input is kept here; this editor stays open until the save is resolved. Reload the report if the save needs reconciliation."
        : (blocked ?? state.message ?? recoveryMessage),
    cancelLabel: detached ? "Close editor" : "Cancel",
    dirty: isRecordInputEdited(state),
    pending: !blocked && !detached && pending,
    canSubmit:
      !blocked && !detached && !pending && (!state.submission || retry),
  };
}

function RecordComposer({
  record,
  state,
  view,
}: {
  readonly record: RecordActions;
  readonly state: OverviewRecordState;
  readonly view: RiskComposerProps["view"];
}) {
  useInlineEditUnloadGuard(view.dirty);
  const common = { view, onSubmit: record.submit, onCancel: record.close };
  return (
    <>
      {record.switchKind && !state.submission && !state.baseline && (
        <fieldset className="flex gap-3">
          <legend>Kind</legend>
          {(["risk", "decision"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="record-kind"
                checked={state.kind === kind}
                onChange={record.switchKind}
              />
              {kind === "risk" ? "Risk" : "Decision"}
            </label>
          ))}
        </fieldset>
      )}
      {state.kind === "risk" ? (
        <StatusOverviewInlineRiskForm
          {...common}
          target={{ kind: "risk", parent: state.parent }}
          value={state.value}
          onChange={record.changeRisk}
        />
      ) : (
        <StatusOverviewInlineDecisionForm
          {...common}
          target={{ kind: "decision", parent: state.parent }}
          value={state.value}
          onChange={record.changeDecision}
        />
      )}
    </>
  );
}

export function overviewRecordPresentation(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  record: RecordActions,
): { slot: StatusOverviewRecordSlot | undefined; recovery: React.ReactNode } {
  const state = record.state;
  if (!state) return { slot: undefined, recovery: null };
  const unit = model.units.find(
    (candidate) =>
      candidate.kind === state.parent.kind &&
      candidate.id === state.parent.id &&
      !candidate.historical,
  );
  const blocked =
    overviewRecordScopeReason(editor, state) ??
    (unit
      ? null
      : "This reporting unit is no longer available. Your input is retained.");
  const content = (
    <RecordComposer
      record={record}
      state={state}
      view={recordView(editor, state, blocked)}
    />
  );
  return unit && !blocked
    ? { slot: { unitKey: unit.key, content }, recovery: null }
    : { slot: undefined, recovery: content };
}
