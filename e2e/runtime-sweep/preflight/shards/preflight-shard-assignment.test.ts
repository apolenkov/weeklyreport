import { describe, expect, it } from "vitest";

import {
  assertPreflightShardAssignmentMatchesSource,
  createPreflightShardAssignment,
} from "./preflight-shard-assignment.ts";
import { withSource } from "./preflight-shard-assignment-test-support.ts";

describe("source-bound preflight shard assignment", () => {
  it("is deterministic, source ordered, group-complete, and keeps specialized ids global", async () => {
    await withSource((source) => {
      const first = createPreflightShardAssignment(source, 4);
      const second = createPreflightShardAssignment(source, 4);
      expect(second).toEqual(first);
      expect(first.mode).toBe("sharded");
      expect(first.weighting).toBe("state-count-v1");
      expect(first.states.map(({ state }) => state.stateId)).toEqual(
        source.plan.states.map(({ stateId }) => stateId),
      );
      expect(first.states.map(({ planIndex }) => planIndex)).toEqual(
        source.plan.states.map((_, planIndex) => planIndex),
      );
      expect(first.specializedDeclarationIds).toEqual(
        source.specializedDeclarations.map(
          ({ declarationId }) => declarationId,
        ),
      );
      expect(first.shards).toHaveLength(4);
      expect(
        first.shards.flatMap(({ states }) =>
          states.map(({ state }) => state.stateId),
        ),
      ).toHaveLength(source.plan.states.length);
      expect(
        first.shards
          .flatMap(({ states }) => states.map(({ planIndex }) => planIndex))
          .toSorted((left, right) => left - right),
      ).toEqual(source.plan.states.map((_, planIndex) => planIndex));
      const groupOwners = new Map<string, number>();
      first.shards.forEach((shard) => {
        expect(shard.states.map(({ planIndex }) => planIndex)).toEqual(
          shard.states
            .map(({ planIndex }) => planIndex)
            .toSorted((left, right) => left - right),
        );
        shard.groupKeys.forEach((groupKey) => {
          const previousOwner = groupOwners.get(groupKey);
          expect(previousOwner ?? shard.shardIndex).toBe(shard.shardIndex);
          groupOwners.set(groupKey, shard.shardIndex);
        });
      });
      expect(
        first.shards
          .flatMap(({ states }) => states.map(({ state }) => state.stateId))
          .filter((stateId) =>
            first.specializedDeclarationIds.includes(stateId),
          ),
      ).toEqual([]);
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(source, first),
      ).not.toThrow();
    });
  });
});
