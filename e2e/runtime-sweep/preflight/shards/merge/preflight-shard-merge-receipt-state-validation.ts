import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { PreflightShardAssignment } from "../preflight-shard-assignment.ts";
import {
  PreflightShardMergeError,
  type PreflightShardMergeReceipt,
} from "./preflight-shard-merge-contract.ts";

const equal = (left: unknown, right: unknown): boolean =>
  stableSerialize(left) === stableSerialize(right);

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length)
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT contains duplicate ${label}`,
    );
};

const receiptShardStateRecords = (input: {
  readonly sourceStateById: ReadonlyMap<
    string,
    SourceArtifact["plan"]["states"][number]
  >;
  readonly assignmentShard: PreflightShardAssignment["shards"][number];
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
}): readonly (readonly [string, string])[] => {
  const expectedStateIds = input.assignmentShard.states.map(
    ({ state }) => state.stateId,
  );
  const expectedStateDigests = input.assignmentShard.states.map(
    ({ stateDigest }) => stateDigest,
  );
  if (
    !equal(input.receiptShard.assignedStateIds, expectedStateIds) ||
    !equal(input.receiptShard.assignedStateDigests, expectedStateDigests)
  )
    throw new PreflightShardMergeError(
      `PREFLIGHT_SHARD_MERGE_RECEIPT state union does not match shard ${input.receiptShard.logicalShardId}`,
    );
  return input.receiptShard.assignedStateIds.map((stateId, stateIndex) => {
    if (
      input.sourceStateById.get(stateId) === undefined ||
      input.receiptShard.assignedStateDigests[stateIndex] !==
        input.assignmentShard.states[stateIndex]?.stateDigest
    )
      throw new PreflightShardMergeError(
        `PREFLIGHT_SHARD_MERGE_RECEIPT references foreign or drifted state ${stateId}`,
      );
    const digest = input.receiptShard.assignedStateDigests[stateIndex];
    if (digest === undefined)
      throw new PreflightShardMergeError("Missing state digest");
    return [stateId, digest] as const;
  });
};

const assertOrderedReceiptStates = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly stateIds: readonly string[];
  readonly digestById: ReadonlyMap<string, string>;
}): void => {
  const expectedStateIds = input.source.plan.states.map(
    ({ stateId }) => stateId,
  );
  if (input.stateIds.length !== expectedStateIds.length)
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT state union does not match SOURCE.json plan order",
    );
  const orderedDigests = expectedStateIds.map((stateId) => {
    if (!input.digestById.has(stateId))
      throw new PreflightShardMergeError(
        `PREFLIGHT_SHARD_MERGE_RECEIPT is missing source state ${stateId}`,
      );
    return input.digestById.get(stateId);
  });
  if (
    !equal(
      input.stateIds.toSorted(
        (left, right) =>
          expectedStateIds.indexOf(left) - expectedStateIds.indexOf(right),
      ),
      expectedStateIds,
    ) ||
    !equal(
      orderedDigests,
      input.assignment.states.map(({ stateDigest }) => stateDigest),
    )
  )
    throw new PreflightShardMergeError(
      "PREFLIGHT_SHARD_MERGE_RECEIPT state union does not match SOURCE.json plan order",
    );
};

export const assertReceiptShardStateUnion = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly receipt: PreflightShardMergeReceipt;
}): void => {
  const sourceStateById = new Map(
    input.source.plan.states.map((state) => [state.stateId, state]),
  );
  const assignmentShardById = new Map(
    input.assignment.shards.map((shard) => [shard.logicalShardId, shard]),
  );
  const receiptStateRecords = input.receipt.shards.flatMap(
    (receiptShard, expectedIndex) => {
      const assignmentShard = input.assignment.shards[expectedIndex];
      if (assignmentShard === undefined)
        throw new PreflightShardMergeError(
          "PREFLIGHT_SHARD_MERGE_RECEIPT shard identities are missing, extra, or reordered",
        );
      if (
        receiptShard.logicalShardId !== assignmentShard.logicalShardId ||
        receiptShard.shardIndex !== assignmentShard.shardIndex ||
        receiptShard.shardDigest !== assignmentShard.shardDigest
      )
        throw new PreflightShardMergeError(
          "PREFLIGHT_SHARD_MERGE_RECEIPT shard identities are missing, extra, or reordered",
        );
      const expectedShard = assignmentShardById.get(
        receiptShard.logicalShardId,
      );
      if (expectedShard === undefined)
        throw new PreflightShardMergeError(
          `PREFLIGHT_SHARD_MERGE_RECEIPT references foreign shard ${receiptShard.logicalShardId}`,
        );
      return receiptShardStateRecords({
        sourceStateById,
        assignmentShard: expectedShard,
        receiptShard,
      });
    },
  );
  const receiptStateIds = receiptStateRecords.map(([stateId]) => stateId);
  const receiptDigestById = new Map(receiptStateRecords);
  assertUnique(receiptStateIds, "state identity");
  assertOrderedReceiptStates({
    source: input.source,
    assignment: input.assignment,
    stateIds: receiptStateIds,
    digestById: receiptDigestById,
  });
};
