import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { sha256Hex } from "../../support/ids.ts";
import { assertPreflightLaunchGate } from "../launch/preflight-launch-guard.ts";
import {
  assertPreflightCanaryPassForSource,
  createPreflightCanaryPass,
  resolvePreflightCampaignKind,
  resolvePreflightCanarySelection,
  writePreflightCanaryArtifact,
} from "./preflight-canary.ts";

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

describe("exact-state preflight launch gate", () => {
  it("requires the supported chain and rejects a synthetic PASS for a direct repair full launch", async () => {
    await withSource(async (source) => {
      expect(() => resolvePreflightCampaignKind({})).toThrow(
        "RUNTIME_SWEEP_CAMPAIGN_KIND is required",
      );
      await expect(
        assertPreflightLaunchGate({
          mode: "full",
          source,
          repoRoot: "/fixture",
          campaignKind: "initial",
          runGitCommand: fakeManifestGit(),
        }),
      ).resolves.toEqual({ campaignKind: "initial", canaryRequired: false });
      await expect(
        assertPreflightLaunchGate({
          mode: "full",
          source,
          repoRoot: "/fixture",
          campaignKind: "repair",
          runGitCommand: fakeManifestGit(),
        }),
      ).rejects.toThrow("must use the supported");

      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selection = resolvePreflightCanarySelection({
        source,
        selector: { stateId: state.stateId },
      });
      const absentCanary = path.join(
        tmpdir(),
        `absent-${source.sourceDigest}-PREFLIGHT_CANARY.json`,
      );
      await expect(
        assertPreflightLaunchGate({
          mode: "canary",
          source,
          repoRoot: "/fixture",
          campaignKind: "repair",
          selector: {
            stateId: state.stateId,
            role: "viewer",
          },
          canaryPath: absentCanary,
          stateId: state.stateId,
          runGitCommand: fakeManifestGit(),
        }),
      ).rejects.toThrow("role does not match");
      await expect(
        assertPreflightLaunchGate({
          mode: "canary",
          source,
          repoRoot: "/fixture",
          campaignKind: "repair",
          selector: selection.selector,
          canaryPath: absentCanary,
          stateId: state.stateId,
          runGitCommand: fakeManifestGit(),
        }),
      ).resolves.toEqual({
        campaignKind: "repair",
        canaryRequired: true,
      });
      const pass = createPreflightCanaryPass({
        source,
        selection,
        segment: { state, controls: [], specialized: [] },
        capturedAt: "2026-08-12T00:00:00.000Z",
      });
      if (pass.status !== "PASS") throw new Error("fixture canary is not PASS");
      const driftedProfile: typeof pass.segment.state.profile =
        pass.segment.state.profile === "demo" ? "full" : "demo";
      const staleSegment = {
        ...pass,
        segment: {
          ...pass.segment,
          state: {
            ...pass.segment.state,
            profile: driftedProfile,
          },
        },
      };
      const forged = {
        ...staleSegment,
        segmentDigest: sha256Hex({
          segment: staleSegment.segment,
          revealPaths: staleSegment.revealPaths,
          revealSurfaces: staleSegment.revealSurfaces,
          revealTransitions: staleSegment.revealTransitions,
        }),
      };
      const { canaryDigest: _oldDigest, ...forgedBody } = forged;
      expect(() =>
        assertPreflightCanaryPassForSource({
          source,
          canary: { ...forged, canaryDigest: sha256Hex(forgedBody) },
          stateId: state.stateId,
        }),
      ).toThrow("segment state does not exactly match SOURCE.json");
      const root = await mkdtemp(path.join(tmpdir(), "runtime-launch-gate-"));
      try {
        const artifactPath = path.join(root, "PREFLIGHT_CANARY.json");
        await writePreflightCanaryArtifact(artifactPath, pass);
        await expect(
          assertPreflightLaunchGate({
            mode: "full",
            source,
            repoRoot: "/fixture",
            campaignKind: "repair",
            selector: selection.selector,
            canaryPath: artifactPath,
            stateId: state.stateId,
            runGitCommand: fakeManifestGit(),
          }),
        ).rejects.toThrow("must use the supported");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
