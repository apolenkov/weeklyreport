import { describe, expect, it } from "vitest";

import {
  createRuntimeLaneAssignment,
  type RuntimeLaneAssignment,
} from "./runtime-lane-contract.ts";

const DIGEST = "a".repeat(64);
const SOURCE_SHA = "b".repeat(40);
const ROOT = "/Users/runtime-test/customreport-runtime-r57";

const body = (): Omit<RuntimeLaneAssignment, "assignmentDigest"> => ({
  artifact: "RUNTIME_LANE_ASSIGNMENT",
  version: 1,
  sourceSha: SOURCE_SHA,
  matrixDigest: DIGEST,
  mode: "one-cell",
  sourceArchiveRoot: ROOT,
  sourceArtifacts: {
    SOURCE: DIGEST,
    PREFLIGHT: DIGEST,
    MATRIX: DIGEST,
    MANIFEST: DIGEST,
  },
  profiles: ["minimal"],
  lanes: [
    {
      laneId: "a",
      databaseName: "customreport_e2e_lane_a_test",
      redisPort: 6381,
      apiPort: 3112,
      webPort: 3115,
      archiveRoot: `${ROOT}/lanes/one-cell/a`,
      groups: [{ profile: "minimal", caseIds: ["case-a"] }],
    },
    {
      laneId: "b",
      databaseName: "customreport_e2e_lane_b_test",
      redisPort: 6382,
      apiPort: 3122,
      webPort: 3125,
      archiveRoot: `${ROOT}/lanes/one-cell/b`,
      groups: [{ profile: "minimal", caseIds: ["case-b"] }],
    },
    {
      laneId: "c",
      databaseName: "customreport_e2e_lane_c_test",
      redisPort: 6383,
      apiPort: 3132,
      webPort: 3135,
      archiveRoot: `${ROOT}/lanes/one-cell/c`,
      groups: [{ profile: "minimal", caseIds: ["case-c"] }],
    },
  ],
});

describe("runtime lane assignment contract", () => {
  it("freezes three canonical isolated resource tuples", () => {
    const assignment = createRuntimeLaneAssignment(body());

    expect(assignment.lanes.map(({ laneId }) => laneId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(assignment.assignmentDigest).toHaveLength(DIGEST.length);
  });

  it("rejects a lane resource tuple mismatch", () => {
    const value = body();
    const [first, ...rest] = value.lanes;
    if (first === undefined) throw new Error("Expected lane A");

    expect(() =>
      createRuntimeLaneAssignment({
        ...value,
        lanes: [{ ...first, apiPort: 3200 }, ...rest],
      }),
    ).toThrow(/canonical resource tuple|globally unique/u);
  });

  it("rejects overlapping archive roots and duplicate cases", () => {
    const value = body();
    const [first, second, third] = value.lanes;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("Expected three lanes");
    expect(() =>
      createRuntimeLaneAssignment({
        ...value,
        lanes: [
          first,
          { ...second, archiveRoot: `${first.archiveRoot}/child` },
          third,
        ],
      }),
    ).toThrow(/must not overlap/u);
    expect(() =>
      createRuntimeLaneAssignment({
        ...value,
        lanes: [
          first,
          {
            ...second,
            groups: [{ profile: "minimal", caseIds: ["case-a"] }],
          },
          third,
        ],
      }),
    ).toThrow(/exactly one lane/u);
  });
});
