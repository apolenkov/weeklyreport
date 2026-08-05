import type { DOMControl, EvidenceRef } from "./contracts.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  hasLiveUnavailableSurfaceProof,
  type RuntimeSurfaceExpectation,
} from "./runtime-surface-expectation.ts";

export const controlIssues = (
  matrixCase: MatrixExecutableCase,
  controls: readonly DOMControl[],
  refs: readonly EvidenceRef[],
  surface?: RuntimeSurfaceExpectation,
): readonly string[] => {
  const action =
    "action" in matrixCase.execution ? matrixCase.execution.action : undefined;
  const duplicateKeys = controls
    .map(({ controlKey }) => controlKey)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  const identity = controls.flatMap((control) => [
    ...(control.cellId === matrixCase.caseId
      ? []
      : [
          `${matrixCase.caseId} control ${control.controlKey} has cell id ${control.cellId}`,
        ]),
    ...(control.accessibleName.trim() === ""
      ? [
          `${matrixCase.caseId} control ${control.controlKey} has no accessible name`,
        ]
      : []),
    ...(control.actionResult.kind === "exercised"
      ? control.actionResult.evidenceIds
          .filter((id) => !refs.some(({ artifactId }) => artifactId === id))
          .map(
            (id) =>
              `${matrixCase.caseId} control ${control.controlKey} references missing evidence ${id}`,
          )
      : []),
  ]);
  const duplicateIssues = duplicateKeys.map(
    (key) => `${matrixCase.caseId} has duplicate control ${key}`,
  );
  const unavailableSurfaceProof =
    action !== undefined &&
    surface?.productActions === "inapplicable" &&
    hasLiveUnavailableSurfaceProof(refs, action.controlKey);
  const targetIssues =
    action === undefined ||
    action.operation === "navigate" ||
    !["control", "recovery"].includes(matrixCase.execution.kind)
      ? []
      : controls.some(({ controlKey }) => controlKey === action.controlKey)
        ? controls
            .filter(({ controlKey }) => controlKey === action.controlKey)
            .flatMap((control) =>
              control.actionResult.kind === "not-exercised" &&
              !unavailableSurfaceProof
                ? [
                    `${matrixCase.caseId} frozen control ${action.controlKey} was not exercised: ${control.actionResult.reason}`,
                  ]
                : [],
            )
        : unavailableSurfaceProof
          ? []
          : [
              `${matrixCase.caseId} is missing frozen control ${action.controlKey}`,
            ];
  return [...identity, ...duplicateIssues, ...targetIssues];
};
