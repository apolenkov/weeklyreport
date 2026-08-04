import {
  type DriverShardAssignment,
  DriverShardError,
} from "./driver-shard-types.ts";

const duplicateValues = (values: readonly string[]): readonly string[] =>
  [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ].toSorted((left, right) => left.localeCompare(right));

const mismatchIssues = (
  expected: readonly string[],
  actual: readonly string[],
): readonly string[] => {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const duplicateIssues = duplicateValues(actual).map(
    (caseId) => `duplicate result case ${caseId}`,
  );
  const missingIssues = expected
    .filter((caseId) => !actualSet.has(caseId))
    .map((caseId) => `missing result case ${caseId}`);
  const extraIssues = actual
    .filter((caseId) => !expectedSet.has(caseId))
    .map((caseId) => `out-of-shard result case ${caseId}`);
  const reordered =
    duplicateIssues.length === 0 &&
    missingIssues.length === 0 &&
    extraIssues.length === 0 &&
    expected.some((caseId, index) => actual[index] !== caseId);
  return [
    ...duplicateIssues,
    ...missingIssues,
    ...extraIssues,
    ...(reordered ? ["shard result order is not canonical"] : []),
  ];
};

export function assertExactDriverShardCaseIds(
  shard: DriverShardAssignment,
  actual: readonly string[],
): void {
  const issues = mismatchIssues(shard.caseIds, actual);
  if (issues.length > 0) throw new DriverShardError(issues.join("; "));
}

export interface DriverShardResultLike {
  readonly assignedCells: readonly { readonly cellId: string }[];
  readonly controlResults?: readonly { readonly cellId: string }[];
  readonly candidates?: readonly { readonly cellId: string }[];
}

export function assertDriverShardResult(
  shard: DriverShardAssignment,
  report: DriverShardResultLike,
): void {
  assertExactDriverShardCaseIds(
    shard,
    report.assignedCells.map(({ cellId }) => cellId),
  );
  const expected = new Set(shard.caseIds);
  const referenced = [
    ...(report.controlResults ?? []).map(({ cellId }) => cellId),
    ...(report.candidates ?? []).map(({ cellId }) => cellId),
  ];
  const outside = [
    ...new Set(referenced.filter((caseId) => !expected.has(caseId))),
  ];
  if (outside.length > 0)
    throw new DriverShardError(
      `Driver result references cases outside shard: ${outside.join(", ")}`,
    );
}
