import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import {
  assertPreflightAssignmentMatchesSource,
  createPreflightAssignment,
  parsePreflightAssignment,
  readOrCreatePreflightAssignment,
  writePreflightAssignment,
} from "./preflight-assignment.ts";

const withSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

describe("preflight assignment", () => {
  it("is deterministically computed from SOURCE and rejects order or digest drift", async () => {
    await withSource((source) => {
      const assignment = createPreflightAssignment(source);
      expect(assignment.states.map(({ planIndex }) => planIndex)).toEqual(
        source.plan.states.map((_, index) => index),
      );
      expect(createPreflightAssignment(source)).toEqual(assignment);
      expect(() =>
        parsePreflightAssignment({
          ...assignment,
          assignmentDigest: "b".repeat(64),
        }),
      ).toThrow(/digest/u);
      expect(() =>
        assertPreflightAssignmentMatchesSource(source, {
          ...assignment,
          states: assignment.states.toReversed(),
        }),
      ).toThrow(/does not match/u);
    });
  });

  it("creates one immutable archive-local assignment and refuses a symlink path", async () => {
    await withSource(async (source) => {
      const root = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-assignment-")),
      );
      try {
        const assignmentPath = path.join(root, "PREFLIGHT_ASSIGNMENT.json");
        const assignment = await readOrCreatePreflightAssignment({
          archiveRoot: root,
          filePath: assignmentPath,
          source,
        });
        expect(
          JSON.parse(await readFile(assignmentPath, "utf8")),
        ).toMatchObject({
          artifact: "PREFLIGHT_ASSIGNMENT",
          assignmentDigest: assignment.assignmentDigest,
        });
        await expect(
          writePreflightAssignment({
            archiveRoot: root,
            filePath: assignmentPath,
            assignment,
          }),
        ).rejects.toThrow(/Cannot create immutable|EEXIST/u);

        const outside = path.join(root, "outside.json");
        const linkPath = path.join(root, "link.json");
        await symlink(outside, linkPath);
        await expect(
          writePreflightAssignment({
            archiveRoot: root,
            filePath: linkPath,
            assignment,
          }),
        ).rejects.toThrow(/symlink|immutable|EEXIST/u);
        await expect(
          writePreflightAssignment({
            archiveRoot: root,
            filePath: path.join(root, "..", "outside-assignment.json"),
            assignment,
          }),
        ).rejects.toThrow(/escaped archive root|archive path/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
