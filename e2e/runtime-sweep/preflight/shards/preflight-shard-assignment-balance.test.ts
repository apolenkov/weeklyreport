import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../support/ids.ts";
import { routeForState } from "../execution/playwright-preflight-support.ts";
import { preflightSessionGroupKey } from "../runtime/preflight-session.ts";
import {
  createPreflightShardAssignment,
  type PreflightShardAssignment,
} from "./preflight-shard-assignment.ts";
import { withSource } from "./preflight-shard-assignment-test-support.ts";

const groupWeightsFor = (
  assignment: PreflightShardAssignment,
): readonly number[] => {
  const weights = new Map<string, number>();
  assignment.states.forEach(({ groupKey }) =>
    weights.set(groupKey, (weights.get(groupKey) ?? 0) + 1),
  );
  return [...weights.values()];
};

describe("preflight shard assignment balancing", () => {
  it("uses deterministic LPT ordering for a shaped source fixture", async () => {
    await withSource((source) => {
      const grouped = new Map<string, (typeof source.plan.states)[number][]>();
      source.plan.states.forEach((state) => {
        const groupKey = preflightSessionGroupKey(
          state,
          routeForState(source, state),
        );
        grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), state]);
      });
      const singleStateGroups = [...grouped.values()].filter(
        (group) => group.length === 1,
      );
      const doubleStateGroups = [...grouped.values()].filter(
        (group) => group.length === 2,
      );
      const shapedStates = [
        ...singleStateGroups.slice(0, 3).flat(),
        ...doubleStateGroups.slice(0, 4).flat(),
      ];
      const shapedPlanBody = {
        sourceSha: source.sourceSha,
        declaration: source.matrixDeclaration,
        states: shapedStates,
        inapplicable: source.plan.inapplicable,
      };
      const shapedSourceCandidate = {
        ...source,
        plan: {
          ...source.plan,
          states: shapedStates,
          digest: sha256Hex(shapedPlanBody),
        },
      };
      const { sourceDigest: _sourceDigest, ...shapedSourceBody } =
        shapedSourceCandidate;
      const shapedSource = {
        ...shapedSourceCandidate,
        sourceDigest: sha256Hex(shapedSourceBody),
      };
      const assignment = createPreflightShardAssignment(shapedSource, 3);
      const sourceOrderWeights = groupWeightsFor(assignment);
      expect(sourceOrderWeights).toEqual([1, 1, 1, 2, 2, 2, 2]);
      const loadVector = assignment.shards.map(
        ({ totalWeight }) => totalWeight,
      );
      // Source-order greedy assignment produces [5, 3, 3] for this shape;
      // descending-weight LPT produces the required [4, 4, 3].
      expect(loadVector).toEqual([4, 4, 3]);
      expect(loadVector).not.toEqual([5, 3, 3]);
      expect(createPreflightShardAssignment(shapedSource, 3)).toEqual(
        assignment,
      );
    });
  });

  it("requires one non-empty shard per canonical source group", async () => {
    await withSource((source) => {
      const oneShard = createPreflightShardAssignment(source, 1);
      const groupCount = new Set(
        oneShard.states.map(({ groupKey }) => groupKey),
      ).size;
      const boundary = createPreflightShardAssignment(source, groupCount);
      expect(boundary.shards).toHaveLength(groupCount);
      expect(boundary.shards.every(({ states }) => states.length > 0)).toBe(
        true,
      );
      expect(() =>
        createPreflightShardAssignment(source, groupCount + 1),
      ).toThrow(/exceeds canonical group count/u);
    });
  });
});
