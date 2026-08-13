import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../support/ids.ts";
import { preflightJournalStateDigest } from "../journal/preflight-journal-contract.ts";
import {
  assertPreflightShardAssignmentMatchesSource,
  createPreflightShardAssignment,
  parsePreflightShardAssignment,
} from "./preflight-shard-assignment.ts";
import {
  assignmentWithDigest,
  firstShardWithAtLeastTwoStates,
  withSource,
} from "./preflight-shard-assignment-test-support.ts";

describe("preflight shard assignment negative contract", () => {
  it("rejects missing, duplicate, foreign, and reordered global states", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            states: candidate.states.toReversed(),
          })),
        ),
      ).toThrow(/reordered/u);
      const first = assignment.states.at(0);
      if (first === undefined) throw new Error("fixture has no states");
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            states: [
              ...candidate.states.slice(0, 1),
              first,
              ...candidate.states.slice(2),
            ],
          })),
        ),
      ).toThrow(/reordered|duplicate/u);
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            states: candidate.states.slice(1),
          })),
        ),
      ).toThrow(/reordered|missing/u);

      const foreignState = {
        ...first,
        state: { ...first.state, stateId: "foreign-state" },
        stateDigest: preflightJournalStateDigest({
          state: { ...first.state, stateId: "foreign-state" },
          role: first.role,
          catalogRoute: first.catalogRoute,
          resolvedRoute: first.resolvedRoute,
        }),
      };
      const foreign = assignmentWithDigest(assignment, (candidate) => ({
        ...candidate,
        states: candidate.states.map((state) =>
          state.planIndex === first.planIndex ? foreignState : state,
        ),
        shards: candidate.shards.map((shard) => ({
          ...shard,
          states: shard.states.map((state) =>
            state.planIndex === first.planIndex ? foreignState : state,
          ),
        })),
      }));
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(source, foreign),
      ).toThrow(/current SOURCE\.json plan|foreign/u);
    });
  });

  it("rejects non-increasing shard order and split session groups", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 1);
      const shard = firstShardWithAtLeastTwoStates(assignment);
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            shards: candidate.shards.map((current) =>
              current.shardIndex === shard.shardIndex
                ? { ...current, states: current.states.toReversed() }
                : current,
            ),
          })),
        ),
      ).toThrow(/increasing plan order|strictly increasing/u);

      const splitSource = createPreflightShardAssignment(source, 2);
      const sourceShard = splitSource.shards.find(({ states }) =>
        states.some(
          (state) =>
            states.filter(({ groupKey }) => groupKey === state.groupKey)
              .length >= 2,
        ),
      );
      if (sourceShard === undefined)
        throw new Error("fixture has no group with multiple states");
      const splitState = sourceShard.states.find(
        (state) =>
          sourceShard.states.filter(
            ({ groupKey }) => groupKey === state.groupKey,
          ).length >= 2,
      );
      if (splitState === undefined)
        throw new Error("fixture has no split state");
      const target = splitSource.shards.find(
        ({ shardIndex }) => shardIndex !== sourceShard.shardIndex,
      );
      if (target === undefined) throw new Error("fixture has no second shard");
      const split = assignmentWithDigest(splitSource, (candidate) => ({
        ...candidate,
        shards: candidate.shards.map((current) => {
          const states =
            current.shardIndex === sourceShard.shardIndex
              ? current.states.filter(
                  ({ planIndex }) => planIndex !== splitState.planIndex,
                )
              : current.shardIndex === target.shardIndex
                ? [...current.states, splitState]
                : current.states;
          const orderedStates = states.toSorted(
            (left, right) => left.planIndex - right.planIndex,
          );
          return {
            ...current,
            states: orderedStates,
            groupKeys: orderedStates
              .map(({ groupKey }) => groupKey)
              .filter(
                (groupKey, index, values) => values.indexOf(groupKey) === index,
              ),
            totalWeight: orderedStates.length,
          };
        }),
      }));
      expect(() => parsePreflightShardAssignment(split)).toThrow(
        /splits session group/u,
      );
    });
  });

  it("rejects specialized declaration, payload, and digest drift", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 3);
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(
          source,
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            specializedDeclarationIds:
              candidate.specializedDeclarationIds.slice(1),
          })),
        ),
      ).toThrow(/specialized declaration set/u);
      expect(() =>
        assertPreflightShardAssignmentMatchesSource(
          source,
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            specializedDeclarationIds: [
              ...candidate.specializedDeclarationIds.slice(0, -1),
              "unknown-specialized-declaration",
            ],
          })),
        ),
      ).toThrow(/specialized declaration set/u);
      const firstDeclaration = assignment.specializedDeclarationIds.at(0);
      if (firstDeclaration === undefined)
        throw new Error("fixture has no specialized declarations");
      expect(() =>
        parsePreflightShardAssignment({
          ...assignment,
          specializedDeclarationIds: [
            ...assignment.specializedDeclarationIds,
            firstDeclaration,
          ],
          assignmentDigest: sha256Hex({
            ...assignment,
            specializedDeclarationIds: [
              ...assignment.specializedDeclarationIds,
              firstDeclaration,
            ],
            assignmentDigest: undefined,
          }),
        }),
      ).toThrow(/duplicate specialized/u);

      const first = assignment.states.at(0);
      if (first === undefined) throw new Error("fixture has no states");
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            states: candidate.states.map((state) =>
              state.planIndex === first.planIndex
                ? { ...state, stateDigest: "c".repeat(64) }
                : state,
            ),
          })),
        ),
      ).toThrow(/state digest/u);
      expect(() =>
        parsePreflightShardAssignment(
          assignmentWithDigest(assignment, (candidate) => ({
            ...candidate,
            states: candidate.states.map((state) =>
              state.planIndex === first.planIndex
                ? {
                    ...state,
                    state: {
                      ...state.state,
                      axes: { ...state.state.axes, lifecycle: "archived" },
                    },
                  }
                : state,
            ),
          })),
        ),
      ).toThrow(/state digest|payload does not match/u);
      expect(() =>
        parsePreflightShardAssignment({
          ...assignment,
          assignmentDigest: "d".repeat(64),
        }),
      ).toThrow(/assignment.*digest/iu);
      const firstShard = assignment.shards.at(0);
      if (firstShard === undefined) throw new Error("fixture has no shards");
      const tamperedShards = assignment.shards.map((shard, index) =>
        index === 0 ? { ...shard, shardDigest: "e".repeat(64) } : shard,
      );
      expect(() =>
        parsePreflightShardAssignment({
          ...assignment,
          shards: tamperedShards,
          assignmentDigest: sha256Hex({
            ...assignment,
            shards: tamperedShards,
            assignmentDigest: undefined,
          }),
        }),
      ).toThrow(/shard.*digest/u);
    });
  });

  it("rejects stale source identity and duplicate shard identity", async () => {
    await withSource((source) => {
      const assignment = createPreflightShardAssignment(source, 2);
      for (const field of [
        "sourceSha",
        "sourceTree",
        "treeDigest",
        "sourceDigest",
        "planDigest",
      ] as const) {
        const replacement = field.endsWith("Digest")
          ? "f".repeat(64)
          : "f".repeat(40);
        const stale = assignmentWithDigest(assignment, (candidate) => ({
          ...candidate,
          [field]: replacement,
        }));
        expect(() =>
          assertPreflightShardAssignmentMatchesSource(source, stale),
        ).toThrow(/does not match SOURCE\.json|logical shard id drifted/u);
      }
      const firstShard = assignment.shards.at(0);
      if (firstShard === undefined) throw new Error("fixture has no shards");
      const duplicateShard = assignmentWithDigest(assignment, (candidate) => ({
        ...candidate,
        shards: candidate.shards.map((shard, index) =>
          index === 1
            ? {
                ...shard,
                shardIndex: 0,
                logicalShardId: firstShard.logicalShardId,
              }
            : shard,
        ),
      }));
      expect(() => parsePreflightShardAssignment(duplicateShard)).toThrow(
        /shard indices|logical shard id/u,
      );
    });
  });
});
