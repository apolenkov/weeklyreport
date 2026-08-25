import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../support/ids.ts";
import { preflightJournalStateDigest } from "../journal/preflight-journal-contract.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  createPreflightShardAssignment,
  logicalShardIdFor,
  parsePreflightShardAssignment,
  type PreflightShardAssignment,
  type PreflightShardState,
} from "./preflight-shard-assignment.ts";
import {
  assignmentWithDigest,
  withSource,
} from "./preflight-shard-assignment-test-support.ts";

const groupKeysFor = (
  states: readonly PreflightShardState[],
): readonly string[] =>
  states
    .map(({ groupKey }) => groupKey)
    .filter((groupKey, index, values) => values.indexOf(groupKey) === index);

const assignmentWithStateMutations = (
  assignment: PreflightShardAssignment,
  predicate: (state: PreflightShardState) => boolean,
  mutate: (state: PreflightShardState) => PreflightShardState,
): PreflightShardAssignment =>
  assignmentWithDigest(assignment, (candidate) => {
    const update = (state: PreflightShardState): PreflightShardState =>
      predicate(state) ? mutate(state) : state;
    const states = candidate.states.map(update);
    const shards = candidate.shards.map((shard) => {
      const shardStates = shard.states.map(update);
      return {
        ...shard,
        states: shardStates,
        groupKeys: groupKeysFor(shardStates),
        totalWeight: shardStates.length,
      };
    });
    return { ...candidate, states, shards };
  });

describe("preflight shard assignment source guards", () => {
  it("reports a missing shard state after global ordering validation", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 1);
      const lastState = assignment.states.at(-1);
      if (lastState === undefined) throw new Error("fixture has no states");
      const withoutState = assignmentWithDigest(assignment, (candidate) => ({
        ...candidate,
        shards: candidate.shards.map((shard) => {
          const states = shard.states.filter(
            ({ planIndex }) => planIndex !== lastState.planIndex,
          );
          return {
            ...shard,
            states,
            groupKeys: groupKeysFor(states),
            totalWeight: states.length,
          };
        }),
      }));
      expect(() => parsePreflightShardAssignment(withoutState)).toThrow(
        /missing global state/u,
      );
    });
  });

  it("rejects specialized declaration order drift independently", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      const reordered = assignmentWithDigest(assignment, (candidate) => ({
        ...candidate,
        specializedDeclarationIds:
          candidate.specializedDeclarationIds.toReversed(),
      }));
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(source, reordered),
      ).toThrow(/specialized declaration order/u);
    });
  });

  it("rejects group-key drift against the current SOURCE plan", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      const first = assignment.states.at(0);
      if (first === undefined) throw new Error("fixture has no states");
      const drifted = assignmentWithStateMutations(
        assignment,
        (state) => state.groupKey === first.groupKey,
        (state) => ({ ...state, groupKey: `${state.groupKey}:drifted` }),
      );
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(source, drifted),
      ).toThrow(/current SOURCE\.json plan/u);
    });
  });

  it("rejects role and route identity drift after local digest recomputation", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      const first = assignment.states.at(0);
      if (first === undefined) throw new Error("fixture has no states");
      for (const field of ["role", "catalogRoute", "resolvedRoute"] as const) {
        const drifted = assignmentWithStateMutations(
          assignment,
          (state) => state.state.stateId === first.state.stateId,
          (state) => {
            const route = {
              role: field === "role" ? `${state.role}:drifted` : state.role,
              catalogRoute:
                field === "catalogRoute"
                  ? `${state.catalogRoute}:drifted`
                  : state.catalogRoute,
              resolvedRoute:
                field === "resolvedRoute"
                  ? `${state.resolvedRoute}:drifted`
                  : state.resolvedRoute,
            };
            return {
              ...state,
              ...route,
              stateDigest: preflightJournalStateDigest({
                state: state.state,
                ...route,
              }),
            };
          },
        );
        expect(() =>
          assertPreflightShardAssignmentMatchesSource(source, drifted),
        ).toThrow(/current SOURCE\.json plan/u);
      }
    });
  });

  it("rejects semantic specialized-declaration drift with preserved ids", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      const firstDeclaration = source.specializedDeclarations.at(0);
      if (firstDeclaration === undefined)
        throw new Error("fixture has no specialized declarations");
      const sourceCandidate = {
        ...source,
        specializedDeclarations: source.specializedDeclarations.map(
          (declaration) =>
            declaration.declarationId === firstDeclaration.declarationId
              ? {
                  ...declaration,
                  proof: {
                    ...declaration.proof,
                    target: `${declaration.proof.target}:drifted`,
                  },
                }
              : declaration,
        ),
      };
      const { sourceDigest: _sourceDigest, ...sourceBody } = sourceCandidate;
      const sourceWithDrift = {
        ...sourceCandidate,
        sourceDigest: sha256Hex(sourceBody),
      };
      const assignmentBoundToDriftedSource = assignmentWithDigest(
        assignment,
        (candidate) => {
          const identity = {
            ...candidate,
            sourceDigest: sourceWithDrift.sourceDigest,
          };
          return {
            ...identity,
            shards: candidate.shards.map((shard) => ({
              ...shard,
              logicalShardId: logicalShardIdFor(identity, shard.shardIndex),
            })),
          };
        },
      );
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(
          sourceWithDrift,
          assignmentBoundToDriftedSource,
        ),
      ).toThrow(/specialized declarations|canonical/u);
    });
  });
});
