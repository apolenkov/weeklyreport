import {
  access,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createRuntimeLaneAssignment } from "./runtime-lane-contract.ts";
import {
  prepareRuntimeLaneArchives,
  readFileDigest,
  RUNTIME_SOURCE_FILES,
} from "./runtime-lane-files.ts";

const SOURCE_SHA = "a".repeat(40);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const fixture = async () => {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "runtime-lane-files-")),
  );
  roots.push(root);
  await Promise.all(
    RUNTIME_SOURCE_FILES.map(([fileName]) =>
      writeFile(path.join(root, fileName), `${fileName}\n`, "utf8"),
    ),
  );
  const digests = await Promise.all(
    RUNTIME_SOURCE_FILES.map(([fileName]) =>
      readFileDigest(path.join(root, fileName)),
    ),
  );
  const digestAt = (index: number): string => {
    const digest = digests[index];
    if (digest === undefined) throw new Error(`Missing digest ${index}`);
    return digest;
  };
  return {
    root,
    assignment: createRuntimeLaneAssignment({
      artifact: "RUNTIME_LANE_ASSIGNMENT",
      version: 1,
      sourceSha: SOURCE_SHA,
      matrixDigest: "b".repeat(64),
      mode: "one-cell",
      sourceArchiveRoot: root,
      sourceArtifacts: {
        SOURCE: digestAt(0),
        PREFLIGHT: digestAt(1),
        MATRIX: digestAt(2),
        MANIFEST: digestAt(3),
      },
      profiles: ["minimal"],
      lanes: [
        {
          laneId: "a",
          databaseName: "customreport_e2e_lane_a_test",
          redisPort: 6381,
          apiPort: 3112,
          webPort: 3115,
          archiveRoot: path.join(root, "lanes", "one-cell", "a"),
          groups: [{ profile: "minimal", caseIds: ["case-a"] }],
        },
        {
          laneId: "b",
          databaseName: "customreport_e2e_lane_b_test",
          redisPort: 6382,
          apiPort: 3122,
          webPort: 3125,
          archiveRoot: path.join(root, "lanes", "one-cell", "b"),
          groups: [{ profile: "minimal", caseIds: ["case-b"] }],
        },
        {
          laneId: "c",
          databaseName: "customreport_e2e_lane_c_test",
          redisPort: 6383,
          apiPort: 3132,
          webPort: 3135,
          archiveRoot: path.join(root, "lanes", "one-cell", "c"),
          groups: [{ profile: "minimal", caseIds: ["case-c"] }],
        },
      ],
    }),
  };
};

describe("runtime lane archive containment", () => {
  it("rejects a parent symlink before creating an external lane", async () => {
    const { root, assignment } = await fixture();
    const outside = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "runtime-lane-outside-")),
    );
    roots.push(outside);
    await mkdir(path.join(root, "lanes"));
    await symlink(outside, path.join(root, "lanes", "one-cell"));

    await expect(prepareRuntimeLaneArchives(assignment)).rejects.toThrow(
      /not a regular directory/u,
    );
    await expect(access(path.join(outside, "a"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a source artifact symlink before creating lane roots", async () => {
    const { root, assignment } = await fixture();
    const sourcePath = path.join(root, "SOURCE.json");
    const realSourcePath = path.join(root, "SOURCE.real.json");
    await writeFile(realSourcePath, "SOURCE.json\n", "utf8");
    await rm(sourcePath);
    await symlink(realSourcePath, sourcePath);

    await expect(prepareRuntimeLaneArchives(assignment)).rejects.toThrow(
      /not a regular file/u,
    );
    await expect(
      access(assignment.lanes[0]?.archiveRoot ?? ""),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an existing symlink target after exclusive copy refusal", async () => {
    const { root, assignment } = await fixture();
    const firstLane = assignment.lanes[0];
    if (firstLane === undefined) throw new Error("Missing lane A");
    await mkdir(firstLane.archiveRoot, { recursive: true });
    await symlink(
      path.join(root, "SOURCE.json"),
      path.join(firstLane.archiveRoot, "SOURCE.json"),
    );

    await expect(prepareRuntimeLaneArchives(assignment)).rejects.toThrow(
      /not a regular file/u,
    );
  });
});
