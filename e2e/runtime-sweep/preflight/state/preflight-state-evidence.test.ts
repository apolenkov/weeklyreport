import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../support/ids.ts";
import { createPreflightAssignment } from "../artifacts/preflight-assignment.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../journal/preflight-journal-artifact.ts";
import {
  createPreflightStateEvidence,
  createPreflightStateSelector,
  readPreflightStateEvidence,
  resolvePreflightStateSelector,
} from "./preflight-state.ts";
import {
  artifactFor,
  canonicalAxisMutations,
  selfConsistentAxisDrift,
  withSource,
} from "./preflight-state-test-support.ts";

describe("state-scoped PREFLIGHT_SEGMENT evidence", () => {
  it("wraps the immutable PREFLIGHT_SEGMENT without creating a second artifact", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const assignment = createPreflightAssignment(source);
      const selection = resolvePreflightStateSelector({
        source,
        selector: createPreflightStateSelector({ source, state }),
      });
      const artifact = artifactFor({
        source,
        state,
        route: selection.route,
        assignment,
      });
      const evidence = createPreflightStateEvidence({
        source,
        selector: selection.selector,
        artifact,
        assignment,
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
      const assignment = createPreflightAssignment(source);
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = artifactFor({
        source,
        state,
        route: selection.route,
        assignment,
      });
      const { artifactDigest: _artifactDigest, ...body } = artifact;
      const driftedBody = { ...body, sourceSha: "b".repeat(40) };
      expect(() =>
        createPreflightStateEvidence({
          source,
          selector,
          assignment,
          artifact: {
            ...driftedBody,
            artifactDigest: sha256Hex(driftedBody),
          },
        }),
      ).toThrow("source SHA");
    });
  });

  it("rejects foreign and stale assignment identities", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const assignment = createPreflightAssignment(source);
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = artifactFor({
        source,
        state,
        route: selection.route,
        assignment,
      });
      const foreignArtifact = createPreflightSegmentArtifact({
        source,
        assignmentDigest: "b".repeat(64),
        state,
        route: selection.route,
        segment: { state, controls: [], specialized: [] },
      });
      expect(() =>
        createPreflightStateEvidence({
          source,
          selector,
          assignment,
          artifact: foreignArtifact,
        }),
      ).toThrow("assignment digest");

      const { assignmentDigest: _assignmentDigest, ...staleBody } = assignment;
      const staleWithSource = { ...staleBody, sourceSha: "c".repeat(40) };
      const staleAssignment = {
        ...staleWithSource,
        assignmentDigest: sha256Hex(staleWithSource),
      };
      expect(() =>
        createPreflightStateEvidence({
          source,
          selector,
          assignment: staleAssignment,
          artifact,
        }),
      ).toThrow("does not match the current SOURCE.json plan");
    });
  });

  it("rejects every self-consistent per-axis state drift in the binder", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const assignment = createPreflightAssignment(source);
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = artifactFor({
        source,
        state,
        route: selection.route,
        assignment,
      });
      for (const [axis, mutate] of canonicalAxisMutations) {
        expect(
          () =>
            createPreflightStateEvidence({
              source,
              selector,
              assignment,
              artifact: selfConsistentAxisDrift(artifact, mutate),
            }),
          `${axis} axis drift must be rejected by the binder`,
        ).toThrow("state digest");
      }
    });
  });

  it("retains archive-root, regular-file, and symlink guards when reading evidence", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const assignment = createPreflightAssignment(source);
      const selector = createPreflightStateSelector({ source, state });
      const selection = resolvePreflightStateSelector({ source, selector });
      const artifact = artifactFor({
        source,
        state,
        route: selection.route,
        assignment,
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
          assignment,
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
            assignment,
          }),
        ).rejects.toThrow(/symlink|regular file/u);
        await expect(
          readPreflightStateEvidence({
            source,
            selector,
            archiveRoot: root,
            filePath: path.join(root, "..", "outside.json"),
            assignment,
          }),
        ).rejects.toThrow(/escaped archive root|archive path/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
