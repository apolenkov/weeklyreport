import type { Action, CoverageCell } from "./contracts.ts";
import { stableSerialize } from "./ids.ts";
import type {
  MatrixCoverageGap,
  MatrixCoverageIssueKind,
} from "./matrix-coverage.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const IDENTITY_MISMATCH: MatrixCoverageIssueKind = "identity-mismatch";
const issue = (
  kind: MatrixCoverageIssueKind,
  message: string,
  caseId: string,
): MatrixCoverageGap => ({ kind, message, caseId });

const actionForCoverageCase = (matrixCase: MatrixExecutableCase): Action => {
  if ("action" in matrixCase.execution) return matrixCase.execution.action;
  const { observation } = matrixCase.execution;
  return {
    controlKey: `observation:${observation.observationId}`,
    operation: "navigate",
    safety: "read-only",
    transition: matrixCase.execution.kind === "idle" ? "idle" : "none",
  };
};

export const isSpecializedCoverageCase = (
  matrixCase: MatrixExecutableCase,
): boolean =>
  !["navigation", "idle"].includes(matrixCase.execution.kind) ||
  matrixCase.state.fault !== "none" ||
  matrixCase.state.controlTransition !== "none";

const expectedFaultId = (matrixCase: MatrixExecutableCase): string | null =>
  "faultId" in matrixCase.execution ? matrixCase.execution.faultId : null;

const identityMismatches = (
  matrixCase: MatrixExecutableCase,
  cell: CoverageCell,
): readonly MatrixCoverageGap[] => {
  const expectedAction = actionForCoverageCase(matrixCase);
  const expectedFault = expectedFaultId(matrixCase);
  const fields: readonly (readonly [string, boolean])[] = [
    ["source SHA", cell.sourceSha === matrixCase.sourceSha],
    ["profile", cell.profile === matrixCase.profile],
    ["role", cell.role === matrixCase.role],
    ["catalog route", cell.catalogRoute === matrixCase.catalogRoute],
    ["resolved route", cell.resolvedRoute === matrixCase.resolvedRoute],
    [
      "state",
      stableSerialize(cell.state) === stableSerialize(matrixCase.state),
    ],
    [
      "execution",
      stableSerialize(cell.execution) === stableSerialize(matrixCase.execution),
    ],
    [
      "action",
      stableSerialize(cell.action) === stableSerialize(expectedAction),
    ],
    ["fault id", cell.faultId === expectedFault],
    [
      "viewport",
      stableSerialize(cell.viewport) ===
        stableSerialize({ browser: "chromium", width: 1440, height: 900 }),
    ],
  ];
  return fields.flatMap(([field, matches]) =>
    matches
      ? []
      : [
          issue(
            IDENTITY_MISMATCH,
            `${matrixCase.caseId} ${field} does not match frozen MATRIX case`,
            matrixCase.caseId,
          ),
        ],
  );
};

const transitionMismatches = (
  matrixCase: MatrixExecutableCase,
  cell: CoverageCell,
): readonly MatrixCoverageGap[] => {
  const expectedAction = actionForCoverageCase(matrixCase);
  return [
    ...(cell.action.transition !== expectedAction.transition
      ? [
          issue(
            IDENTITY_MISMATCH,
            `${matrixCase.caseId} action transition ${cell.action.transition} does not match ${expectedAction.transition}`,
            matrixCase.caseId,
          ),
        ]
      : []),
    ...(cell.state.controlTransition !== matrixCase.state.controlTransition
      ? [
          issue(
            IDENTITY_MISMATCH,
            `${matrixCase.caseId} control transition does not match frozen MATRIX state`,
            matrixCase.caseId,
          ),
        ]
      : []),
    ...(cell.state.fault !== matrixCase.state.fault
      ? [
          issue(
            IDENTITY_MISMATCH,
            `${matrixCase.caseId} fault mode does not match frozen MATRIX state`,
            matrixCase.caseId,
          ),
        ]
      : []),
  ];
};

const fabricatedNoneMismatches = (
  matrixCase: MatrixExecutableCase,
  cell: CoverageCell,
): readonly MatrixCoverageGap[] =>
  [
    ...(matrixCase.state.fault !== "none" && cell.state.fault === "none"
      ? ["fault"]
      : []),
    ...(matrixCase.state.controlTransition !== "none" &&
    cell.state.controlTransition === "none"
      ? ["control transition"]
      : []),
  ].map((axis) =>
    issue(
      "fabricated-none-witness",
      `${matrixCase.caseId} uses none for required ${axis} specialization`,
      matrixCase.caseId,
    ),
  );

export const coverageIdentityIssues = (
  matrixCase: MatrixExecutableCase,
  cell: CoverageCell,
): readonly MatrixCoverageGap[] => [
  ...identityMismatches(matrixCase, cell),
  ...transitionMismatches(matrixCase, cell),
  ...fabricatedNoneMismatches(matrixCase, cell),
];

export const sameNominalCoverageWitness = (
  matrixCase: MatrixExecutableCase,
  cell: CoverageCell,
): boolean => {
  const expectedState = {
    ...matrixCase.state,
    fault: "none",
    controlTransition: "none",
  };
  const actualState = {
    ...cell.state,
    fault: "none",
    controlTransition: "none",
  };
  const expectedAction = actionForCoverageCase(matrixCase);
  return (
    cell.profile === matrixCase.profile &&
    cell.role === matrixCase.role &&
    cell.catalogRoute === matrixCase.catalogRoute &&
    stableSerialize(actualState) === stableSerialize(expectedState) &&
    cell.action.controlKey === expectedAction.controlKey &&
    cell.action.operation === expectedAction.operation
  );
};
