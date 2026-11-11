import type { Dispatch, SetStateAction } from "react";

import type {
  DecisionInput,
  DraftPatch,
  LeadFormGeneration,
  Parent,
  RiskInput,
  StatusOverviewModel,
  StatusOverviewRecordTarget,
} from "../../../../report-sections";
import {
  leadFormGenerationOf,
  ownedStagesForProject,
} from "../../../../report-sections";
import type { ReadyEditor } from "./use-overview-controller";

type CreatedRecord = Extract<DraftPatch, { reportSectionId: string }>["record"];
type Input = RiskInput | DecisionInput;

export interface OverviewRecordSubmission {
  readonly token: string;
  readonly record: CreatedRecord;
  readonly before: CreatedRecord | null;
  readonly input: Input;
  readonly phase: "prepared" | "patched" | "saving";
  readonly cancelRequested: boolean;
  readonly cancelRetried: boolean;
  readonly discard: {
    readonly token: string;
    readonly armed: boolean;
  } | null;
}

interface RecordStateContext {
  readonly parent: Parent;
  readonly identity: { readonly id: string; readonly stableId: string };
  readonly generation: LeadFormGeneration;
  readonly reportSectionId: string;
  readonly receiptScope: string;
  readonly initial: Input;
  readonly baseline: CreatedRecord | null;
  readonly submission: OverviewRecordSubmission | null;
  readonly errors: Readonly<Record<string, string>>;
  readonly message: string | null;
}

export type OverviewRecordState = RecordStateContext &
  (
    | { readonly kind: "risk"; readonly value: RiskInput }
    | { readonly kind: "decision"; readonly value: DecisionInput }
  );

export type SetOverviewRecord = Dispatch<
  SetStateAction<OverviewRecordState | null>
>;

export function updateRecordAttempt(
  setState: SetOverviewRecord,
  token: string,
  update: (
    current: OverviewRecordState,
    active: OverviewRecordSubmission,
  ) => OverviewRecordState | null,
): void {
  setState((current) =>
    current?.submission?.token === token
      ? update(current, current.submission)
      : current,
  );
}

export function isRecordInputEdited(state: OverviewRecordState): boolean {
  return (
    state.submission !== null ||
    JSON.stringify(state.value) !== JSON.stringify(state.initial)
  );
}

export function createOverviewRecordState(
  editor: ReadyEditor,
  model: StatusOverviewModel,
  target: StatusOverviewRecordTarget,
): OverviewRecordState | null {
  const generation = leadFormGenerationOf(editor.draft.section);
  if (editor.view.viewModel.isReadOnly || editor.generation !== generation)
    return null;
  const unit = model.units.find(
    (candidate) =>
      candidate.kind === target.unitKind &&
      candidate.id === target.unitId &&
      !candidate.historical,
  );
  if (!unit) return null;
  const stages =
    target.unitKind === "product"
      ? ownedStagesForProject(editor.draft.section, target.unitId)
      : [];
  const common = {
    parent: { kind: unit.kind, id: unit.id, name: unit.name },
    identity: { id: crypto.randomUUID(), stableId: crypto.randomUUID() },
    generation,
    reportSectionId: editor.draft.section.reportSectionId,
    receiptScope: editor.draft.receiptScope,
    baseline: null,
    submission: null,
    errors: {},
    message: null,
  };
  const input = {
    text: "",
    impact: null,
    stageNames: stages.length === 1 ? stages : [],
  };
  if (target.kind === "risk") {
    const value: RiskInput = {
      ...input,
      mitigation: null,
      severity: "at-risk",
    };
    return { ...common, kind: "risk", value, initial: value };
  }
  const value: DecisionInput = { ...input, deadline: "" };
  return { ...common, kind: "decision", value, initial: value };
}
