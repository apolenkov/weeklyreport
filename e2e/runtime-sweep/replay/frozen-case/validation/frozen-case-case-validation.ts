import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import type { EvidenceRef } from "../../../source/contracts.ts";
import { isRecoveryBackedAction } from "../../control-actions/control-action-policy.ts";
import type { PhaseEvidence } from "./frozen-case-phase-validation.ts";
import { allRefs } from "./frozen-case-phase-validation.ts";

type OracleRequirement = Readonly<{ readonly kind: "api" | "db" }>;
const EXPECTED_TRANSITION_SCREENSHOTS = 2;
const MINIMUM_TRANSITION_GEOMETRY_REFS = 3;

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

const actionRequiresRecovery = (matrixCase: MatrixExecutableCase): boolean =>
  "action" in matrixCase.execution &&
  isRecoveryBackedAction(matrixCase.execution.action);

const recoveryEvidenceIssues = (
  matrixCase: MatrixExecutableCase,
  phases: readonly PhaseEvidence[],
): readonly string[] => {
  if (!actionRequiresRecovery(matrixCase)) return [];
  const action = phases.find(({ phase }) => phase === "action");
  const observations = action?.bundle.observations.filter(
    ({ observationId }) => observationId === "action-recovery",
  );
  if (observations?.length !== 1)
    return [
      `${matrixCase.caseId} action requires exactly one recovery observation`,
    ];
  const evidenceIds = observations[0]?.evidenceIds ?? [];
  const recoveryRefs = (action?.refs ?? []).filter(
    (ref) =>
      evidenceIds.includes(ref.artifactId) &&
      ref.kind === "log" &&
      ref.archivePath.endsWith("/recovery-evidence.json"),
  );
  return recoveryRefs.length === 1
    ? []
    : [`${matrixCase.caseId} action recovery evidence is missing`];
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

const transitionVisualIssues = (
  caseId: string,
  phases: readonly PhaseEvidence[],
): readonly string[] => {
  const refs = allRefs(phases);
  const after = phases.find(({ phase }) => phase === "after");
  const observations = after?.bundle.observations.filter(
    ({ observationId }) => observationId === "transition-visual",
  );
  if (observations?.length !== 1)
    return [`${caseId} after transition-visual observation is missing`];
  const observation = observations[0];
  if (observation === undefined)
    return [`${caseId} after transition-visual observation is missing`];
  const evidence = observation.evidenceIds.flatMap((artifactId) => {
    const ref = refs.find((candidate) => candidate.artifactId === artifactId);
    return ref === undefined ? [] : [ref];
  });
  const missingIds = observation.evidenceIds.filter(
    (artifactId) => !refs.some((ref) => ref.artifactId === artifactId),
  );
  const screenshotCount = evidence.filter(
    ({ kind }) => kind === "screenshot",
  ).length;
  const geometryCount = evidence.filter(
    ({ kind }) => kind === "geometry",
  ).length;
  const pairCount = evidence.filter(({ archivePath }) =>
    archivePath.endsWith("/transition-visual.json"),
  ).length;
  return [
    ...missingIds.map(
      (artifactId) =>
        `${caseId} transition-visual references missing evidence ${artifactId}`,
    ),
    ...(screenshotCount === EXPECTED_TRANSITION_SCREENSHOTS
      ? []
      : [`${caseId} transition-visual requires two screenshot links`]),
    ...(geometryCount >= MINIMUM_TRANSITION_GEOMETRY_REFS
      ? []
      : [
          `${caseId} transition-visual requires paired geometry and adjudication links`,
        ]),
    ...(pairCount === 1
      ? []
      : [`${caseId} transition-visual adjudication artifact is missing`]),
    ...(observation.outcome === "fail"
      ? [`${caseId} transition-visual failed: ${observation.message}`]
      : []),
  ];
};

export const caseSpecificIssues = (
  matrixCase: MatrixExecutableCase,
  phases: readonly PhaseEvidence[],
  actionTransition: string,
): readonly string[] => {
  const refs = allRefs(phases);
  const oracle = oracleForExecution(matrixCase);
  return [
    ...controlActionIssues(matrixCase, refs),
    ...recoveryEvidenceIssues(matrixCase, phases),
    ...oracleIssues(matrixCase, refs, oracle),
    ...cleanupIssues(matrixCase.caseId, refs, oracle),
    ...transitionIssues(matrixCase, actionTransition),
    ...transitionVisualIssues(matrixCase.caseId, phases),
  ];
};
