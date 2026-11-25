import type {
  DecisionInput,
  RiskInput,
  StatusOverviewModel,
  StatusOverviewRecordTarget,
} from "../../../../report-sections";
import { useRetainedOverviewState } from "./overview-input-provider";
import {
  canCloseSubmittedRecord,
  overviewRecordScopeReason,
  prepareOverviewRecord,
} from "./overview-record-context";
import {
  createOverviewRecordState,
  type OverviewRecordState,
  type SetOverviewRecord,
} from "./overview-record-state";
import { retryOriginalSave } from "./overview-save-retry";
import type { RetainedRecordCopy } from "./retained-record-copy";
import type { ReadyEditor } from "./use-overview-controller";
import { useOverviewFocusReturn } from "./use-overview-focus-return";
import { useOverviewRecordSubmission } from "./use-overview-record-submission";

function closeRecordInput(
  editor: ReadyEditor | null,
  current: OverviewRecordState | null,
) {
  if (!current?.submission || current.submission.phase === "prepared")
    return null;
  if (canCloseSubmittedRecord(editor, current)) return null;
  return {
    ...current,
    submission: { ...current.submission, cancelRequested: true },
  };
}

function prefillRecordInput(
  state: OverviewRecordState,
  copy: RetainedRecordCopy,
): OverviewRecordState | null {
  const sameParent =
    copy.sourceParent.kind === state.parent.kind &&
    copy.sourceParent.id === state.parent.id;
  const stageNames = sameParent
    ? [...copy.input.stageNames]
    : state.value.stageNames;
  if (state.kind === "risk" && copy.kind === "risk")
    return { ...state, value: { ...copy.input, stageNames } };
  if (state.kind === "decision" && copy.kind === "decision")
    return { ...state, value: { ...copy.input, stageNames } };
  return null;
}

function useRecordOpener({
  editor,
  model,
  state,
  setState,
  blocked,
}: {
  readonly editor: ReadyEditor | null;
  readonly model: StatusOverviewModel;
  readonly state: OverviewRecordState | null;
  readonly setState: SetOverviewRecord;
  readonly blocked: boolean;
}) {
  const rememberFocus = useOverviewFocusReturn(state !== null);
  return (target: StatusOverviewRecordTarget, copy?: RetainedRecordCopy) => {
    if (!editor || state || blocked) return false;
    const empty = createOverviewRecordState(editor, model, target);
    const next = empty && copy ? prefillRecordInput(empty, copy) : empty;
    if (!next) return false;
    rememberFocus(`add-${target.kind}:${target.unitKind}:${target.unitId}`);
    setState(next);
    return true;
  };
}

export function useOverviewRecordEditor(
  editor: ReadyEditor | null,
  model: StatusOverviewModel,
  reportId: string,
  blocked: boolean,
) {
  const [state, setState] = useRetainedOverviewState("record", reportId);
  const open = useRecordOpener({ editor, model, state, setState, blocked });
  useOverviewRecordSubmission(editor, state, setState);
  const setError = (message: string | null) =>
    setState((current) => (current ? { ...current, message } : current));
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
    open: (target: StatusOverviewRecordTarget) => {
      open(target);
    },
    openCopy: (copy: RetainedRecordCopy, target: StatusOverviewRecordTarget) =>
      open(target, copy),
    submit,
    switchKind: () => switchRecordKind({ editor, model, state, setState }),
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

function switchRecordKind({
  editor,
  model,
  state,
  setState,
}: {
  editor: ReadyEditor | null;
  model: StatusOverviewModel;
  state: OverviewRecordState | null;
  setState: SetOverviewRecord;
}) {
  if (!state || !editor || state.submission || state.baseline) return;
  const next = createOverviewRecordState(editor, model, {
    kind: state.kind === "risk" ? "decision" : "risk",
    unitId: state.parent.id,
    unitKind: state.parent.kind,
  });
  if (next)
    setState({
      ...next,
      value: {
        ...next.value,
        text: state.value.text,
        impact: state.value.impact,
        stageNames: state.value.stageNames,
      },
    } as OverviewRecordState);
}
