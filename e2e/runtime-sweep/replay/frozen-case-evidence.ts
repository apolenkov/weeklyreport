import type { EvidencePhase } from "../evidence/evidence-types.ts";
import { FROZEN_LIVE_TRANSITION_VISUAL_POLICY } from "../evidence/transition-visual-evaluation.ts";
import { attachTransitionVisualEvidence } from "../evidence/transition-visual-evidence.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { RuntimeSurfaceExpectation } from "../preflight/runtime-surface-expectation.ts";
import {
  type Action,
  coverageCellSchema,
  type DOMControl,
  type EvidenceBundle,
  type MatrixExecution,
  type Oracle,
} from "../source/contracts.ts";
import { isRecoveryBackedAction } from "./control-action-policy.ts";
import {
  allRefs,
  caseSpecificIssues,
  controlIssues,
  type FrozenCaseEvidence,
  identityIssues,
  phaseEvidence,
  phaseIssues,
} from "./frozen-case-evidence-validation.ts";

export type CompleteFrozenCaseEvidence = Readonly<
  Record<EvidencePhase, EvidenceBundle>
>;

export type TransitionEvidenceSelection = Readonly<{
  readonly result: EvidenceBundle;
  readonly resultPhase: "action" | "after";
}>;

export interface FrozenCaseReplayInput {
  readonly caseId: string;
  readonly oracle: Oracle;
  readonly controls: readonly DOMControl[];
  readonly evidence: FrozenCaseEvidence;
  readonly cellId?: string;
  readonly surface?: RuntimeSurfaceExpectation;
}

export interface FrozenCaseReplayResult {
  readonly cell: FrozenCaseCoverageCell;
  readonly issues: readonly string[];
}

export interface FrozenCasePhaseCaptureInput {
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly controls:
    | readonly DOMControl[]
    | ((evidence: CompleteFrozenCaseEvidence) => readonly DOMControl[]);
  readonly cellId?: string;
  readonly surface?: RuntimeSurfaceExpectation;
  readonly capturePhase: (phase: EvidencePhase) => Promise<EvidenceBundle>;
}

export type FrozenCaseEvidenceFinalizationInput = Omit<
  FrozenCasePhaseCaptureInput,
  "capturePhase"
>;

const frozenCaseCoverageCellSchema = coverageCellSchema;

export type FrozenCaseCoverageCell = ReturnType<
  typeof frozenCaseCoverageCellSchema.parse
>;

class FrozenCaseReplayError extends Error {
  override readonly name = "FrozenCaseReplayError";
}

const executionAction = (execution: MatrixExecution): Action | undefined =>
  "action" in execution ? execution.action : undefined;

export const transitionEvidenceSelection = (
  matrixCase: MatrixExecutableCase,
  captured: CompleteFrozenCaseEvidence,
): TransitionEvidenceSelection => {
  const action = executionAction(matrixCase.execution);
  return action !== undefined && isRecoveryBackedAction(action)
    ? { result: captured.action, resultPhase: "action" }
    : { result: captured.after, resultPhase: "after" };
};

const actionFor = (matrixCase: MatrixExecutableCase): Action => {
  const declared = executionAction(matrixCase.execution);
  if (declared !== undefined) return declared;
  if (!("observation" in matrixCase.execution))
    throw new Error(
      `Frozen case ${matrixCase.caseId} has no action or observation`,
    );
  const observation = matrixCase.execution.observation;
  return {
    controlKey: `observation:${observation.observationId}`,
    operation: "navigate",
    safety: "read-only",
    transition: matrixCase.execution.kind === "idle" ? "idle" : "none",
  };
};

const unique = (issues: readonly string[]): readonly string[] =>
  issues.filter((issue, index) => issues.indexOf(issue) === index);

const replayIssues = (
  matrixCase: MatrixExecutableCase,
  input: FrozenCaseReplayInput,
  phases: ReturnType<typeof phaseEvidence>,
  action: Action,
): readonly string[] => {
  const refs = allRefs(phases);
  return unique([
    ...(input.caseId === matrixCase.caseId
      ? []
      : [
          `supplied case id ${input.caseId} does not equal frozen case ${matrixCase.caseId}`,
        ]),
    ...(input.cellId === undefined || input.cellId === matrixCase.caseId
      ? []
      : [
          `supplied cell id ${input.cellId} does not equal frozen case ${matrixCase.caseId}`,
        ]),
    ...phases.flatMap((phase) => [
      ...phaseIssues(matrixCase.caseId, phase, refs),
    ]),
    ...identityIssues(matrixCase, refs),
    ...controlIssues(matrixCase, input.controls, refs, input.surface),
    ...caseSpecificIssues(matrixCase, phases, action.transition),
  ]);
};

export function replayFrozenCase(
  matrixCase: MatrixExecutableCase,
  input: FrozenCaseReplayInput,
): FrozenCaseReplayResult {
  const phases = phaseEvidence(input.evidence);
  const action = actionFor(matrixCase);
  const issues = replayIssues(matrixCase, input, phases, action);
  const faultId =
    "faultId" in matrixCase.execution
      ? { faultId: matrixCase.execution.faultId }
      : { faultId: null };
  const cell = frozenCaseCoverageCellSchema.parse({
    cellId: matrixCase.caseId,
    sourceSha: matrixCase.sourceSha,
    profile: matrixCase.profile,
    role: matrixCase.role,
    catalogRoute: matrixCase.catalogRoute,
    resolvedRoute: matrixCase.resolvedRoute,
    viewport: { browser: "chromium", width: 1440, height: 900 },
    state: matrixCase.state,
    action,
    execution: matrixCase.execution,
    ...faultId,
    oracle: input.oracle,
    controls: input.controls,
    evidence: {
      before: phases[0]?.refs ?? [],
      action: phases[1]?.refs ?? [],
      after: phases[2]?.refs ?? [],
      observations: phases.flatMap(({ bundle }) => bundle.observations),
      inapplicable: phases.flatMap(({ bundle }) => bundle.inapplicable),
    },
    verdict: issues.length === 0 ? "pass" : "fail",
  });
  return { cell, issues };
}

export async function finalizeFrozenCaseEvidence(
  input: FrozenCaseEvidenceFinalizationInput,
  captured: CompleteFrozenCaseEvidence,
): Promise<FrozenCaseReplayResult> {
  const selection = transitionEvidenceSelection(input.matrixCase, captured);
  const after = await attachTransitionVisualEvidence({
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    before: captured.before,
    ...selection,
    attachTo: captured.after,
    policy: FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
  });
  const evidence: CompleteFrozenCaseEvidence = { ...captured, after };
  const controls =
    typeof input.controls === "function"
      ? input.controls(evidence)
      : input.controls;
  return replayFrozenCase(input.matrixCase, {
    caseId: input.matrixCase.caseId,
    ...(input.cellId === undefined ? {} : { cellId: input.cellId }),
    oracle: input.oracle,
    controls,
    evidence,
    ...(input.surface === undefined ? {} : { surface: input.surface }),
  });
}

export async function captureFrozenCasePhases(
  input: FrozenCasePhaseCaptureInput,
): Promise<FrozenCaseReplayResult> {
  const before = await input.capturePhase("before");
  const action = await input.capturePhase("action");
  const after = await input.capturePhase("after");
  return finalizeFrozenCaseEvidence(input, { before, action, after });
}

export function replayFrozenCases(
  cases: readonly MatrixExecutableCase[],
  inputs: readonly FrozenCaseReplayInput[],
): readonly FrozenCaseReplayResult[] {
  const expectedIds = cases.map(({ caseId }) => caseId);
  const actualIds = inputs.map(({ caseId }) => caseId);
  const duplicateIds = actualIds.filter(
    (caseId, index) => actualIds.indexOf(caseId) !== index,
  );
  const missingIds = expectedIds.filter(
    (caseId) => !actualIds.includes(caseId),
  );
  const extraIds = actualIds.filter((caseId) => !expectedIds.includes(caseId));
  const issues = [
    ...duplicateIds.map((caseId) => `duplicate replay input ${caseId}`),
    ...missingIds.map((caseId) => `missing replay input ${caseId}`),
    ...extraIds.map((caseId) => `unexpected replay input ${caseId}`),
  ];
  if (issues.length > 0) throw new FrozenCaseReplayError(issues.join("; "));
  return cases.map((matrixCase) => {
    const input = inputs.find(({ caseId }) => caseId === matrixCase.caseId);
    if (input === undefined)
      throw new FrozenCaseReplayError(
        `missing replay input ${matrixCase.caseId}`,
      );
    return replayFrozenCase(matrixCase, input);
  });
}
