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
  readonly changeRisk: (value: RiskInput) => void;
  readonly changeDecision: (value: DecisionInput) => void;
}

function recordSaveProgress(
  editor: ReadyEditor | null,
  state: OverviewRecordState,
) {
  const submission = state.submission;
  const token = submission?.discard?.token ?? submission?.token;
  const recovery = editor?.draft.saveRecovery;
  const matchingRecovery = recovery?.token === token ? recovery : null;
  const pending =
    !!submission &&
    (submission.phase !== "saving" ||
      (matchingRecovery?.pendingTransports ?? 0) > 0 ||
      matchingRecovery?.phase === "pending" ||
      editor?.draft.autosave.isInFlight === true);
  const retry = matchingRecovery?.phase === "ambiguous";
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
  return {
    eligibleStages: overviewRecordEligibleStages(editor, state),
    authorName: editor?.draft.section.authorName ?? "Unavailable",
    errors: state.errors,
    message: blocked ?? state.message ?? recoveryMessage,
    dirty: isRecordInputEdited(state),
    pending: !blocked && pending,
    canSubmit: !blocked && !pending && (!state.submission || retry),
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
  return state.kind === "risk" ? (
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
