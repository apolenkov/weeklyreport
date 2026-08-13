import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { sha256Hex } from "../../support/ids.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../journal/preflight-journal-artifact.ts";
import {
  createPreflightStateEvidence,
  readPreflightStateEvidence,
} from "./preflight-state-evidence.ts";
import {
  createPreflightStateSelector,
  resolvePreflightStateSelector,
} from "./preflight-state-selector.ts";

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

describe("state-scoped PREFLIGHT_SEGMENT evidence", () => {
  it("wraps the immutable PREFLIGHT_SEGMENT without creating a second artifact", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selection = resolvePreflightStateSelector({
        source,
        selector: createPreflightStateSelector({ source, state }),
      });
      const artifact = createPreflightSegmentArtifact({
        source,
        assignmentDigest: "a".repeat(64),
        state,
        route: selection.route,
        segment: { state, controls: [], specialized: [] },
      });
      const evidence = createPreflightStateEvidence({
        source,
        selector: selection.selector,
        artifact,
      });
      expect(evidence.artifact.artifact).toBe("PREFLIGHT_SEGMENT");
      expect(evidence.artifact.version).toBe(1);
      expect(evidence.artifact.artifactDigest).toHaveLength(64);
      expect(evidence.segment.state.stateId).toBe(state.stateId);
      expect(evidence.selector.stateDigest).toBe(artifact.stateDigest);
    });
  });

  it("rejects a source-bound artifact identity drift before returning evidence", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = createPreflightSegmentArtifact({
        source,
        assignmentDigest: "a".repeat(64),
        state,
        route: selection.route,
        segment: { state, controls: [], specialized: [] },
      });
      const { artifactDigest: _artifactDigest, ...body } = artifact;
      const driftedBody = { ...body, sourceSha: "b".repeat(40) };
      expect(() =>
        createPreflightStateEvidence({
          source,
          selector,
          artifact: {
            ...driftedBody,
            artifactDigest: sha256Hex(driftedBody),
          },
        }),
      ).toThrow("source SHA");
    });
  });

  it("retains archive-root, regular-file, and symlink guards when reading evidence", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = createPreflightSegmentArtifact({
        source,
        assignmentDigest: "a".repeat(64),
        state,
        route: selection.route,
        segment: { state, controls: [], specialized: [] },
      });
      const root = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-state-evidence-")),
      );
      try {
        const filePath = path.join(root, "segments", `${state.stateId}.json`);
        await writePreflightSegmentArtifact({
          filePath,
          artifact,
          archiveRoot: root,
        });
        const evidence = await readPreflightStateEvidence({
          source,
          selector,
          archiveRoot: root,
          filePath,
        });
        expect(evidence.artifact.artifact).toBe("PREFLIGHT_SEGMENT");
        expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual(artifact);

        const linkPath = path.join(root, "link.json");
        await symlink(filePath, linkPath);
        await expect(
          readPreflightStateEvidence({
            source,
            selector,
            archiveRoot: root,
            filePath: linkPath,
          }),
        ).rejects.toThrow(/symlink|regular file/u);
        await expect(
          readPreflightStateEvidence({
            source,
            selector,
            archiveRoot: root,
            filePath: path.join(root, "..", "outside.json"),
          }),
        ).rejects.toThrow(/escaped archive root|archive path/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
