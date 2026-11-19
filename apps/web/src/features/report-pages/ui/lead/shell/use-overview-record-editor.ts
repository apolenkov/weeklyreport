import type {
  DecisionInput,
  RiskInput,
  StatusOverviewModel,
  StatusOverviewRecordTarget,
} from "../../../../report-sections";
import { useRetainedOverviewState } from "./overview-input-provider";
import {
  isRecordScopeDetached,
  overviewRecordScopeReason,
  prepareOverviewRecord,
} from "./overview-record-context";
import {
  createOverviewRecordState,
  type OverviewRecordState,
} from "./overview-record-state";
import { retryOriginalSave } from "./overview-save-retry";
import type { ReadyEditor } from "./use-overview-controller";
import { useOverviewFocusReturn } from "./use-overview-focus-return";
import { useOverviewRecordSubmission } from "./use-overview-record-submission";

function closeRecordInput(
  editor: ReadyEditor | null,
  current: OverviewRecordState | null,
) {
  if (!current?.submission || current.submission.phase === "prepared")
    return null;
  if (
    isRecordScopeDetached(editor, current) ||
    current.submission.phase === "unresolved"
  )
    return null;
  return {
    ...current,
    submission: { ...current.submission, cancelRequested: true },
  };
}

export function useOverviewRecordEditor(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  reportId: string,
  blocked: boolean,
) {
  const [state, setState] = useRetainedOverviewState("record", reportId);
  const rememberFocus = useOverviewFocusReturn(state !== null);
  useOverviewRecordSubmission(editor, state, setState);
  const setError = (message: string | null) =>
    setState((current) => (current ? { ...current, message } : current));
  const open = (target: StatusOverviewRecordTarget) => {
    if (!editor || state || blocked) return;
    const next = createOverviewRecordState(editor, model, target);
    if (!next) return;
    rememberFocus(`add-${target.kind}:${target.unitKind}:${target.unitId}`);
    setState(next);
  };
  const submit = () => {
    if (!state || !editor || overviewRecordScopeReason(editor, state)) return;
    const submission = state.submission;
    const discard = submission?.discard;
    if (submission && discard?.notSent) {
      setState({
        ...state,
        message: null,
        submission: {
          ...submission,
          discard: { ...discard, notSent: false },
        },
      });
      return;
    }
    if (state.submission) {
      retryOriginalSave(
        { setError },
        editor,
        state.submission.discard?.token ?? state.submission.token,
      );
      return;
    }
    const prepared = prepareOverviewRecord(editor, state);
    if (!prepared.ok) {
      setState({ ...state, errors: prepared.errors });
      return;
    }
    setState({
      ...state,
      errors: {},
      message: null,
      submission: {
        token: crypto.randomUUID(),
        record: structuredClone(prepared.record),
        before: state.baseline,
        input: structuredClone(state.value),
        phase: "prepared",
        cancelRequested: false,
        cancelRetried: false,
        discard: null,
      },
    });
  };
  return {
    state,
    open,
    submit,
    changeRisk: (value: RiskInput) =>
      setState((current) =>
        current?.kind === "risk" ? { ...current, value } : current,
      ),
    changeDecision: (value: DecisionInput) =>
      setState((current) =>
        current?.kind === "decision" ? { ...current, value } : current,
      ),
    close: () => setState((current) => closeRecordInput(editor, current)),
  };
}
