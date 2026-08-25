import { readFileSync } from "node:fs";

import type { SeedProfile } from "../../source/contracts.ts";
import {
  parseRuntimeLaneAssignment,
  type RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";

export type RuntimeLaneSelection = Readonly<{
  readonly assignment: RuntimeLaneAssignment;
  readonly caseIds: readonly string[];
}>;

const selectRuntimeLaneCases = (
  assignment: RuntimeLaneAssignment,
  laneId: string,
  profile: SeedProfile,
): readonly string[] => {
  const lane = assignment.lanes.find(
    (candidate) => candidate.laneId === laneId,
  );
  if (lane === undefined)
    throw new Error(`Runtime lane assignment has no lane ${laneId}`);
  const groups = lane.groups.filter(
    ({ profile: candidate }) => candidate === profile,
  );
  const caseIds = groups.flatMap(({ caseIds: assigned }) => assigned);
  if (caseIds.length === 0)
    throw new Error(`Runtime lane ${laneId} has no ${profile} cases`);
  return caseIds;
};

export const loadRuntimeLaneSelection = (
  assignmentPath: string,
  laneId: string,
  profile: SeedProfile,
): RuntimeLaneSelection => {
  const assignment = parseRuntimeLaneAssignment(
    JSON.parse(readFileSync(assignmentPath, "utf8")),
  );
  return {
    assignment,
    caseIds: selectRuntimeLaneCases(assignment, laneId, profile),
  };
};
