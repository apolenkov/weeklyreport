import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { stableSerialize } from "../../../support/ids.ts";
import type { RevealBootstrap } from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_SURFACE,
} from "../continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  type RevealContinuationAsset,
  writeRevealContinuationAsset,
} from "../continuation/preflight-reveal-continuation-assets.ts";
import {
  branchAssetFor,
  candidateFrontierFor,
} from "../continuation/receipts/preflight-reveal-continuation-receipt-assets.ts";
import { assetsForCandidateFrontier } from "../continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import { adaptSourceBoundCapacityFrontier } from "./preflight-reveal-capacity-frontier-adapter.ts";
import { fullReductionFixtureFor } from "./preflight-reveal-capacity-frontier-full-fixture.ts";
import { fixtureFor } from "./preflight-reveal-capacity-frontier-test-fixture.ts";
import { readRevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";
import { pendingBranchManifestFieldsFor } from "./preflight-reveal-failure-frontier-pending-branch.ts";
import {
  readFailureFrontierManifest,
  rewriteFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-test-support.ts";

type FrontierAsset = Extract<
  RevealContinuationAsset,
  {
    artifact:
      | typeof PREFLIGHT_REVEAL_BRANCH
      | typeof PREFLIGHT_REVEAL_CANDIDATE_LIST
      | typeof PREFLIGHT_REVEAL_INVENTORY
      | typeof PREFLIGHT_REVEAL_PATH_NODE
      | typeof PREFLIGHT_REVEAL_SURFACE;
  }
>;

const isFrontierAsset = (
  asset: RevealContinuationAsset,
): asset is FrontierAsset => {
  switch (asset.artifact) {
    case PREFLIGHT_REVEAL_BRANCH:
    case PREFLIGHT_REVEAL_CANDIDATE_LIST:
    case PREFLIGHT_REVEAL_INVENTORY:
    case PREFLIGHT_REVEAL_PATH_NODE:
    case PREFLIGHT_REVEAL_SURFACE:
      return true;
    default:
      return false;
  }
};

const reasonFor = (
  result: ReturnType<typeof adaptSourceBoundCapacityFrontier>,
) => {
  if (result.kind !== "rejected") throw new Error("Fixture unexpectedly ready");
  return result.reason;
};

describe("source-bound capacity frontier negative bindings", () => {
  it("fails closed on source, state, candidate, and receipt tampering", async () => {
    const { fixture, input, bootstrap, packetRoot } = await fixtureFor();
    try {
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            packet: {
              ...input.packet,
              manifest: {
                ...input.packet.manifest,
                sourceSha: "b".repeat(40),
              },
            },
          }),
        ),
      ).toBe("source-frontier-not-bound");
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            bootstrap: {
              ...bootstrap,
              reducerStateDigest: "f".repeat(64),
            },
          }),
        ),
      ).toBe("receipt-chain-invalid");
      const firstCandidate = input.packet.candidates[0];
      if (firstCandidate === undefined)
        throw new Error("Negative fixture candidate is missing");
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            packet: {
              ...input.packet,
              candidates: [
                {
                  ...firstCandidate,
                  action: {
                    ...firstCandidate.action,
                    controlKey: "button:tampered:0",
                  },
                },
              ],
            },
          }),
        ),
      ).toBe("source-frontier-not-bound");
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            receipts: [{}],
          }),
        ),
      ).toBe("receipt-chain-invalid");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("rejects a packet whose genesis or candidate cursor was substituted", async () => {
    const { fixture, input, bootstrap, packetRoot } = await fixtureFor();
    try {
      const tamperedBootstrap: RevealBootstrap = {
        ...bootstrap,
        genesis: { ...bootstrap.genesis, url: "/tampered" },
        bootstrapDigest: bootstrap.bootstrapDigest,
      };
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            bootstrap: tamperedBootstrap,
          }),
        ),
      ).toBe("receipt-chain-invalid");
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            packet: {
              ...input.packet,
              manifest: {
                ...input.packet.manifest,
                candidateIndex: 1,
              },
            },
          }),
        ),
      ).toBe("source-frontier-not-bound");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("rejects substituting another valid queued branch as the pending branch", async () => {
    const { fixture, input, packetRoot, plan, alternateBranch } =
      await fullReductionFixtureFor();
    try {
      const currentCandidates = input.initialState.currentCandidates;
      if (currentCandidates === undefined)
        throw new Error("Current fixture candidates are missing");
      const currentFrontier = candidateFrontierFor({
        branch: input.packet.branch,
        candidates: currentCandidates,
      });
      const alternateAsset = branchAssetFor(alternateBranch);
      const closure = assetsForCandidateFrontier({
        ...currentFrontier,
        additionalBranchRefs: [alternateAsset.digest],
      }).filter(isFrontierAsset);
      const manifest = await readFailureFrontierManifest(packetRoot);
      const existing = new Set(
        manifest.assets.map(({ artifact, ref }) => `${artifact}:${ref}`),
      );
      for (const asset of closure) {
        if (existing.has(`${asset.artifact}:${asset.digest}`)) continue;
        await writeRevealContinuationAsset({ archiveRoot: packetRoot, asset });
      }
      const assets = closure
        .map((asset) => ({
          artifact: asset.artifact,
          ref: asset.digest,
          bytes: Buffer.byteLength(`${stableSerialize(asset)}\n`, "utf8"),
        }))
        .toSorted((left, right) =>
          `${left.artifact}:${left.ref}`.localeCompare(
            `${right.artifact}:${right.ref}`,
          ),
        );
      await rewriteFailureFrontierManifest(packetRoot, (body) => ({
        ...body,
        ...pendingBranchManifestFieldsFor(alternateAsset),
        assets,
      }));
      await expect(
        readRevealFailureFrontierPacket({
          packetRoot,
          expectedPlan: plan,
        }),
      ).rejects.toThrow(
        "Failure-frontier pending branch is not bound to the current frontier",
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });
});
