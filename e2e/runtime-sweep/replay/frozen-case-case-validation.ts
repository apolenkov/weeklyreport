import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { EvidenceRef } from "../source/contracts.ts";
import type { PhaseEvidence } from "./frozen-case-phase-validation.ts";
import { allRefs } from "./frozen-case-phase-validation.ts";

type OracleRequirement = Readonly<{ readonly kind: "api" | "db" }>;

const oracleForExecution = (
  matrixCase: MatrixExecutableCase,
): OracleRequirement | undefined =>
  matrixCase.execution.kind === "infrastructure" &&
  "observation" in matrixCase.execution
    ? { kind: matrixCase.execution.observation.kind }
    : ["recovery", "fault", "concurrency"].includes(matrixCase.execution.kind)
      ? { kind: "db" }
      : undefined;

const controlActionIssues = (
  matrixCase: MatrixExecutableCase,
  refs: readonly EvidenceRef[],
): readonly string[] => {
  const needsControlAction =
    "action" in matrixCase.execution &&
    !["navigation", "idle"].includes(matrixCase.execution.kind);
  return needsControlAction &&
    !refs.some(({ kind }) => kind === "control-action")
    ? [`${matrixCase.caseId} action evidence is missing control-action`]
    : [];
};

const oracleIssues = (
  matrixCase: MatrixExecutableCase,
  refs: readonly EvidenceRef[],
  oracle: OracleRequirement | undefined,
): readonly string[] => {
  if (oracle === undefined || refs.some(({ kind }) => kind === oracle.kind))
    return [];
  return [
    oracle.kind === "db"
      ? `${matrixCase.caseId} requires database oracle evidence for ${matrixCase.execution.kind} execution`
      : `${matrixCase.caseId} requires ${oracle.kind} infrastructure observation evidence`,
  ];
};

const cleanupIssues = (
  caseId: string,
  refs: readonly EvidenceRef[],
  oracle: OracleRequirement | undefined,
): readonly string[] => {
  if (
    oracle === undefined ||
    refs.some(
      ({ archivePath }) =>
        archivePath.includes("/after/") &&
        archivePath.toLowerCase().includes("cleanup"),
    )
  )
    return [];
  return [`${caseId} requires runtime cleanup evidence`];
};

const transitionIssues = (
  matrixCase: MatrixExecutableCase,
  actionTransition: string,
): readonly string[] =>
  matrixCase.state.controlTransition === actionTransition
    ? []
    : [
        `${matrixCase.caseId} state transition ${matrixCase.state.controlTransition} does not match action transition ${actionTransition}`,
      ];

export const caseSpecificIssues = (
  matrixCase: MatrixExecutableCase,
  phases: readonly PhaseEvidence[],
  actionTransition: string,
): readonly string[] => {
  const refs = allRefs(phases);
  const oracle = oracleForExecution(matrixCase);
  return [
    ...controlActionIssues(matrixCase, refs),
    ...oracleIssues(matrixCase, refs, oracle),
    ...cleanupIssues(matrixCase.caseId, refs, oracle),
    ...transitionIssues(matrixCase, actionTransition),
  ];
};
