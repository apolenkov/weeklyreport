import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";

export const MAX_FROZEN_CASE_LIVE_SHARD_CASES = 32;

export type FrozenCaseLiveShard = Readonly<{
  readonly shardIndex: number;
  readonly shardCount: number;
  readonly cases: readonly MatrixExecutableCase[];
  readonly caseIds: readonly string[];
}>;

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
