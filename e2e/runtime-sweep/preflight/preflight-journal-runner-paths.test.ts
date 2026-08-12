import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import {
  createPreflightAssignment,
  runJournaledPreflight,
  writePreflightAssignment,
} from "./preflight-journal.ts";

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

const segmentFor = (
  state: Awaited<
    ReturnType<typeof buildCampaignSource>
  >["plan"]["states"][number],
) => ({ state, controls: [], specialized: [] });

describe("journaled preflight archive paths", () => {
  it("rejects a symlinked canonical PREFLIGHT output", async () => {
    await withSource(async (source) => {
      const archiveRoot = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-canonical-")),
      );
      const assignment = createPreflightAssignment(source);
      const assignmentPath = path.join(
        archiveRoot,
        "PREFLIGHT_ASSIGNMENT.json",
      );
      const outside = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-canonical-outside-")),
      );
      try {
        await writePreflightAssignment({
          archiveRoot,
          filePath: assignmentPath,
          assignment,
        });
        const preflightPath = path.join(archiveRoot, "PREFLIGHT.json");
        await symlink(path.join(outside, "PREFLIGHT.json"), preflightPath);
        await expect(
          runJournaledPreflight({
            source,
            assignment,
            assignmentPath,
            archiveRoot,
            journalPath: path.join(archiveRoot, "journal.jsonl"),
            preflightPath,
            segmentRoot: path.join(archiveRoot, "segments"),
            assertLiveSource: () => Promise.resolve(),
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        ).rejects.toThrow(/symlink|regular file|archive path/u);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
        await rm(outside, { recursive: true, force: true });
      }
    });
  });
});
