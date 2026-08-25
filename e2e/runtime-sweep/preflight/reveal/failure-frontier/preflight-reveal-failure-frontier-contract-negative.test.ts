import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { createCapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import {
  assertFailureFrontierBindings,
  requiredFailureFrontierBranch,
  requiredFailureFrontierCandidates,
} from "./preflight-reveal-failure-frontier-content.ts";
import {
  FAILURE_FRONTIER_LIMITS,
  parseRevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";
import { readRevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";
import {
  createFailureFrontierPacket,
  manifestValueFor,
  readFailureFrontierManifest,
  rewriteFailureFrontierManifest,
  withFailureFrontierRoot,
} from "./preflight-reveal-failure-frontier-test-support.ts";

const changedPlan = (field: "sourceSha" | "planDigest") => {
  const plan = makePlan();
  const { planArtifactDigest: _planArtifactDigest, ...body } = plan;
  return createCapacitySurveyPlan({
    ...body,
    [field]: field === "sourceSha" ? "9".repeat(40) : "8".repeat(64),
  });
};

describe("failure-frontier contract rejection", () => {
  it("rejects duplicate and reordered asset declarations", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      await createFailureFrontierPacket(packetRoot);
      const manifest = await readFailureFrontierManifest(packetRoot);
      const { manifestDigest: _manifestDigest, ...body } = manifest;
      const first = body.assets[0];
      expect(first).toBeDefined();
      if (first === undefined) return;
      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({ ...body, assets: [first, first] }),
        ),
      ).toThrow(/duplicate/iu);
      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({ ...body, assets: body.assets.toReversed() }),
        ),
      ).toThrow(/canonical order/iu);
    });
  });

  it("rejects stale and foreign exact plans", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      await createFailureFrontierPacket(packetRoot);
      for (const expectedPlan of [
        changedPlan("sourceSha"),
        changedPlan("planDigest"),
      ]) {
        await expect(
          readRevealFailureFrontierPacket({ packetRoot, expectedPlan }),
        ).rejects.toThrow(/does not match exact capacity plan/iu);
      }
    });
  });

  it("rejects path-shaped refs, per-asset overflow, and aggregate overflow", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      await createFailureFrontierPacket(packetRoot);
      const manifest = await readFailureFrontierManifest(packetRoot);
      const { manifestDigest: _manifestDigest, ...body } = manifest;
      const first = body.assets[0];
      expect(first).toBeDefined();
      if (first === undefined) return;

      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({
            ...body,
            assets: [{ ...first, ref: "../outside" }],
          }),
        ),
      ).toThrow(/invalid failure-frontier manifest/iu);
      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({
            ...body,
            assets: [
              { ...first, bytes: FAILURE_FRONTIER_LIMITS.maxAssetBytes + 1 },
            ],
          }),
        ),
      ).toThrow(/invalid failure-frontier manifest/iu);

      const aggregateAssets = Array.from({ length: 9 }, (_, index) => ({
        artifact: first.artifact,
        ref: sha256Hex(`aggregate-${String(index)}`),
        bytes: FAILURE_FRONTIER_LIMITS.maxAssetBytes,
      })).toSorted((left, right) =>
        `${left.artifact}:${left.ref}`.localeCompare(
          `${right.artifact}:${right.ref}`,
        ),
      );
      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({ ...body, assets: aggregateAssets }),
        ),
      ).toThrow(/aggregate byte bound/iu);
    });
  });

  it("rejects asset-count and branch-depth overflow", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      await createFailureFrontierPacket(packetRoot);
      const manifest = await readFailureFrontierManifest(packetRoot);
      const { manifestDigest: _manifestDigest, ...body } = manifest;
      const first = body.assets[0];
      expect(first).toBeDefined();
      if (first === undefined) return;
      const excessAssets = Array.from(
        { length: FAILURE_FRONTIER_LIMITS.maxAssets + 1 },
        (_, index) => ({
          artifact: first.artifact,
          ref: sha256Hex(`asset-${String(index)}`),
          bytes: 1,
        }),
      ).toSorted((left, right) =>
        `${left.artifact}:${left.ref}`.localeCompare(
          `${right.artifact}:${right.ref}`,
        ),
      );
      expect(() =>
        parseRevealFailureFrontierManifest(
          manifestValueFor({ ...body, assets: excessAssets }),
        ),
      ).toThrow(/invalid failure-frontier manifest/iu);

      const branch = requiredFailureFrontierBranch(manifest.branchRef);
      const candidates = requiredFailureFrontierCandidates(
        manifest.candidateListRef,
      );
      expect(() =>
        assertFailureFrontierBindings({
          manifest,
          branch: {
            ...branch,
            depth: FAILURE_FRONTIER_LIMITS.maxDepth + 1,
          },
          candidates,
        }),
      ).toThrow(/depth bound/iu);
    });
  });

  it("rejects a canonical manifest whose exact closure is reordered", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      await rewriteFailureFrontierManifest(packetRoot, (body) => ({
        ...body,
        assets: body.assets.toReversed(),
      }));
      await expect(
        readRevealFailureFrontierPacket({ packetRoot, expectedPlan: plan }),
      ).rejects.toThrow(/canonical order/iu);
    });
  });
});
