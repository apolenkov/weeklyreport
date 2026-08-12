import { describe, expect, it } from "vitest";

import {
  createRuntimeLaneAssignment,
  type RuntimeLaneAssignment,
  runtimeLaneResources,
} from "./runtime-lane-contract.ts";

const DIGEST = "a".repeat(64);
const SOURCE_SHA = "b".repeat(40);
const ROOT = "/Users/runtime-test/customreport-runtime-r57";

const body = (
  laneCount = 3,
): Omit<RuntimeLaneAssignment, "assignmentDigest"> => ({
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
  lanes: runtimeLaneResources(laneCount).map((resource) => ({
    ...resource,
    archiveRoot: `${ROOT}/lanes/one-cell/${resource.laneId}`,
    groups: [
      { profile: "minimal" as const, caseIds: [`case-${resource.laneId}`] },
    ],
  })),
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

  it.each([10, 15])(
    "freezes %i contiguous canonical isolated resource tuples",
    (laneCount) => {
      const assignment = createRuntimeLaneAssignment(body(laneCount));
      const last = assignment.lanes.at(-1);

      expect(assignment.lanes).toHaveLength(laneCount);
      expect(last).toMatchObject(runtimeLaneResources(laneCount).at(-1) ?? {});
    },
  );

  it("rejects lane counts outside the supported range", () => {
    expect(() => runtimeLaneResources(0)).toThrow(/integer from 1 to 15/u);
    expect(() => runtimeLaneResources(16)).toThrow(/integer from 1 to 15/u);
    expect(() => runtimeLaneResources(1.5)).toThrow(/integer from 1 to 15/u);
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
