import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { FrozenCaseCoverageCell } from "./frozen-case-evidence.ts";

export const MAX_FROZEN_CASE_LIVE_SHARD_CASES = 32;

export type FrozenCaseLiveShard = Readonly<{
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly cases: readonly MatrixExecutableCase[];
  readonly caseIds: readonly string[];
}>;

export type FrozenCaseGroup = readonly MatrixExecutableCase[];

export const groupFrozenCases = (
  cases: readonly MatrixExecutableCase[],
  groupKeyFor: (matrixCase: MatrixExecutableCase) => string,
): readonly FrozenCaseGroup[] => {
  const keyed = cases.map((matrixCase) => ({
    key: groupKeyFor(matrixCase),
    matrixCase,
  }));
  const keys = [...new Set(keyed.map(({ key }) => key))];
  return keys.map((key) =>
    keyed
      .filter((candidate) => candidate.key === key)
      .map(({ matrixCase }) => matrixCase),
  );
};

export const restoreFrozenCaseOrder = (
  cases: readonly MatrixExecutableCase[],
  cells: readonly FrozenCaseCoverageCell[],
): readonly FrozenCaseCoverageCell[] => {
  const byId = new Map(cells.map((cell) => [cell.cellId, cell] as const));
  return cases.map((matrixCase) => {
    const cell = byId.get(matrixCase.caseId);
    if (cell === undefined)
      throw new Error(`Frozen case ${matrixCase.caseId} produced no cell`);
    return cell;
  });
};

export const createFrozenCaseLiveShardPlan = (
  cases: readonly MatrixExecutableCase[],
): readonly FrozenCaseLiveShard[] => {
  const shardCount = Math.ceil(cases.length / MAX_FROZEN_CASE_LIVE_SHARD_CASES);
  return Array.from({ length: shardCount }, (_, shardIndex) => {
    const shardCases = cases.slice(
      shardIndex * MAX_FROZEN_CASE_LIVE_SHARD_CASES,
      (shardIndex + 1) * MAX_FROZEN_CASE_LIVE_SHARD_CASES,
    );
    return {
      shardIndex,
      shardCount,
      cases: shardCases,
      caseIds: shardCases.map(({ caseId }) => caseId),
    };
  });
};
